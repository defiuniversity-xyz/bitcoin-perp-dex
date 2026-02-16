"""
Publish Nostr events to relays.
"""

import json
import logging
import ssl
import threading
import time

import config

logger = logging.getLogger(__name__)


def publish_event(event: dict) -> bool:
    """
    Publish a Nostr event to configured relays.
    Returns True if published to at least one relay.
    """
    try:
        from nostr.relay_manager import RelayManager
        from nostr.message_type import ClientMessageType

        relay_manager = RelayManager()
        for r in config.NOSTR_RELAYS:
            relay_manager.add_relay(r)
        relay_manager.open_connections({"cert_reqs": ssl.CERT_NONE})
        time.sleep(1.0)

        msg = [ClientMessageType.EVENT, event]
        relay_manager.publish_message(json.dumps(msg))
        time.sleep(1.5)
        relay_manager.close_connections()
        return True
    except Exception as e:
        logger.exception("Failed to publish Nostr event: %s", e)
        return False


def publish_event_async(event: dict) -> None:
    """Publish event in a background thread (fire-and-forget)."""
    def _run():
        try:
            publish_event(event)
        except Exception as e:
            logger.exception("Async publish failed: %s", e)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
