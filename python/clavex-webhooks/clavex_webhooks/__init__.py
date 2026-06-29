"""
clavex_webhooks — Webhook signature verification for Clavex Identity Platform.

Usage::

    from clavex_webhooks import Webhook, WebhookVerificationError

    wh = Webhook("whsec_your_signing_secret")

    try:
        payload = wh.verify(
            body=request.body,          # raw bytes or str
            signature=request.headers["X-Clavex-Signature"],
        )
    except WebhookVerificationError as exc:
        return 400, str(exc)
"""

from __future__ import annotations

import hashlib
import hmac


class WebhookVerificationError(Exception):
    """Raised when the webhook signature cannot be verified."""


class Webhook:
    """Verify Clavex webhook signatures.

    Args:
        secret: The signing secret shown in the Clavex dashboard, as a plain
                string.  The ``whsec_`` prefix is stripped automatically.
    """

    def __init__(self, secret: str) -> None:
        key = secret.removeprefix("whsec_")
        self._key: bytes = key.encode() if isinstance(key, str) else key

    # ------------------------------------------------------------------
    def verify(self, body: bytes | str, signature: str) -> bytes:
        """Verify *signature* and return the raw *body* on success.

        The expected header format is ``sha256=<hex-digest>``.

        Raises:
            WebhookVerificationError: if the signature is absent, malformed,
                or does not match *body*.
        """
        if not signature:
            raise WebhookVerificationError("missing signature header")

        if not signature.startswith("sha256="):
            raise WebhookVerificationError(
                f"unsupported signature scheme: {signature[:20]!r}"
            )

        received_hex = signature[len("sha256="):]

        raw = body.encode() if isinstance(body, str) else body
        expected_hex = hmac.new(self._key, raw, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_hex, received_hex):
            raise WebhookVerificationError("signature mismatch")

        return raw


# ── Convenience wrapper ───────────────────────────────────────────────────────

def verify(secret: str, signature: str, body: bytes | str) -> bytes:
    """One-shot helper — equivalent to ``Webhook(secret).verify(body, signature)``."""
    return Webhook(secret).verify(body, signature)


__all__ = ["Webhook", "WebhookVerificationError", "verify"]
