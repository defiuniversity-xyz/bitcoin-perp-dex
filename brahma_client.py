import subprocess
import json
import os
import logging

logger = logging.getLogger(__name__)

# Path to the nodejs service
SERVICE_DIR = os.path.join(os.path.dirname(__file__), 'brahma-service')
SCRIPT_PATH = os.path.join(SERVICE_DIR, 'index.js')

class BrahmaClient:
    def __init__(self):
        self._ensure_setup()

    def _ensure_setup(self):
        if not os.path.exists(SCRIPT_PATH):
            logger.warning(f"Brahma service script not found at {SCRIPT_PATH}")

    def _run_node_script(self, command, args):
        try:
            cmd = ['node', SCRIPT_PATH, command] + args
            result = subprocess.run(
                cmd, 
                cwd=SERVICE_DIR, 
                capture_output=True, 
                text=True, 
                check=True
            )
            return json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running brahma script: {e.stderr}")
            # Try to parse stderr if it's JSON, otherwise return generic error
            try:
                return json.loads(e.stderr)
            except:
                return {"status": "error", "message": str(e)}
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from brahma script: {result.stdout}")
            return {"status": "error", "message": "Invalid response from service"}

    def deploy_console(self, owner_pubkey):
        """
        Deploy a new console for a user.
        Owner pubkey is used as the identifier (mock address).
        """
        # In a real app we'd convert pubkey to an ETH address or use a mapping
        # For mock, we just use the pubkey (or a fake ETH address derived from it)
        fake_eth_address = "0x" + owner_pubkey[:40] 
        return self._run_node_script('deploy', [fake_eth_address])

    def topup_console(self, owner_pubkey, amount_usdc):
        fake_eth_address = "0x" + owner_pubkey[:40]
        return self._run_node_script('topup', [fake_eth_address, str(amount_usdc)])

    def simulate_spend(self, owner_pubkey, amount_usdc):
        fake_eth_address = "0x" + owner_pubkey[:40]
        return self._run_node_script('spend', [fake_eth_address, str(amount_usdc)])

    def get_console_status(self, owner_pubkey):
        fake_eth_address = "0x" + owner_pubkey[:40]
        return self._run_node_script('balance', [fake_eth_address])
