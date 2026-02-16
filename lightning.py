"""
Lightning backend abstraction for the Bitcoin Bank.

Supports:
- mock: Simulated invoices for development (no real Lightning node)
- lnbits: LNbits API for invoice creation and payment detection
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional

import config

logger = logging.getLogger(__name__)


class LightningBackend(ABC):
    """Abstract interface for Lightning operations."""

    @abstractmethod
    def create_invoice(
        self,
        amount_msats: int,
        description_hash: Optional[bytes] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        """Create a Lightning invoice. Returns {invoice: str, payment_hash: str, payment_secret: str}."""
        pass

    @abstractmethod
    def check_invoice_paid(self, payment_hash: str) -> bool:
        """Check if an invoice has been paid."""
        pass

    @abstractmethod
    def pay_invoice(self, invoice: str) -> dict:
        """Pay a Lightning invoice. Returns {preimage: str} or raises on failure."""
        pass


class MockLightningBackend(LightningBackend):
    """
    Mock Lightning backend for development and testing.

    Invoices are stored in memory. Use the /api/simulate-payment endpoint
    to mark an invoice as paid (simulates webhook).
    """

    def __init__(self):
        self._invoices: dict[str, dict] = {}
        self._paid: set[str] = set()

    def create_invoice(
        self,
        amount_msats: int,
        description_hash: Optional[bytes] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        import secrets
        payment_hash = secrets.token_hex(32)
        payment_secret = secrets.token_hex(32)
        invoice = f"lnbc{amount_msats // 1000}n1mock-invoice-{payment_hash[:16]}"
        self._invoices[payment_hash] = {
            "invoice": invoice,
            "amount_msats": amount_msats,
            "description_hash": description_hash.hex() if description_hash else None,
            "metadata": metadata or {},
        }
        return {
            "invoice": invoice,
            "payment_hash": payment_hash,
            "payment_secret": payment_secret,
        }

    def check_invoice_paid(self, payment_hash: str) -> bool:
        return payment_hash in self._paid

    def pay_invoice(self, invoice: str) -> dict:
        for ph, inv in self._invoices.items():
            if inv["invoice"] == invoice:
                self._paid.add(ph)
                return {"preimage": "mock_preimage_" + ph[:16]}
        raise ValueError("Invoice not found")

    def simulate_payment(self, payment_hash: str) -> bool:
        """Mark an invoice as paid (for testing)."""
        if payment_hash in self._invoices:
            self._paid.add(payment_hash)
            return True
        return False

    def get_invoice_metadata(self, payment_hash: str) -> Optional[dict]:
        """Get metadata stored with the invoice (e.g. zap_request for deposit flow)."""
        return self._invoices.get(payment_hash)


class LNbitsLightningBackend(LightningBackend):
    """LNbits API backend for real Lightning operations."""

    def __init__(self):
        self.base_url = config.LNBITS_URL.rstrip("/")
        self.invoice_key = config.LNBITS_INVOICE_KEY
        if not self.invoice_key:
            raise ValueError("LNBITS_INVOICE_KEY required when using lnbits backend")

    def create_invoice(
        self,
        amount_msats: int,
        description_hash: Optional[bytes] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        import requests
        amount_sats = amount_msats // 1000
        payload = {
            "out": False,
            "amount": amount_sats,
            "memo": metadata.get("memo", "Bitcoin Bank deposit") if metadata else "Bitcoin Bank deposit",
            "unit": "sats",
        }
        if description_hash:
            payload["description_hash"] = description_hash.hex()
        r = requests.post(
            f"{self.base_url}/api/v1/payments",
            json=payload,
            headers={"X-Api-Key": self.invoice_key},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        return {
            "invoice": data["payment_request"],
            "payment_hash": data["payment_hash"],
            "payment_secret": data.get("payment_secret", ""),
            "checking_id": data.get("checking_id", data["payment_hash"]),
        }

    def check_invoice_paid(self, payment_hash: str) -> bool:
        import requests
        r = requests.get(
            f"{self.base_url}/api/v1/payments/{payment_hash}",
            headers={"X-Api-Key": self.invoice_key},
            timeout=10,
        )
        if r.status_code == 404:
            return False
        r.raise_for_status()
        data = r.json()
        return data.get("paid", False)

    def pay_invoice(self, invoice: str) -> dict:
        import requests
        r = requests.post(
            f"{self.base_url}/api/v1/payments",
            json={"out": True, "bolt11": invoice},
            headers={"X-Api-Key": self.invoice_key},
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("payment_hash"):
            return {"preimage": data.get("preimage", "")}
        raise ValueError(data.get("detail", "Payment failed"))


_backend_instance: Optional[LightningBackend] = None


def get_lightning_backend() -> LightningBackend:
    """Factory for Lightning backend based on config (singleton)."""
    global _backend_instance
    if _backend_instance is None:
        if config.LIGHTNING_BACKEND == "lnbits":
            _backend_instance = LNbitsLightningBackend()
        else:
            _backend_instance = MockLightningBackend()
    return _backend_instance
