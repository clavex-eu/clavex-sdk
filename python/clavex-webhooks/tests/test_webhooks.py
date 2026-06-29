"""
Tests for clavex_webhooks — webhook signature verification.

Run with:  pytest
"""
import hashlib
import hmac
import pytest

from clavex_webhooks import Webhook, WebhookVerificationError, verify


# ── helpers ───────────────────────────────────────────────────────────────────

def sign(secret: str, body: bytes) -> str:
    """Produce the sha256=<hex> signature the Clavex server sends."""
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


# ── Webhook class ─────────────────────────────────────────────────────────────

def test_valid_signature_returns_raw_body():
    secret = "test-secret-abc"
    body = b'{"event":"user.created","data":{}}'
    sig = sign(secret, body)
    result = Webhook(secret).verify(body, sig)
    assert result == body


def test_valid_signature_with_str_body():
    secret = "str-body-secret"
    body_str = '{"event":"user.updated"}'
    sig = sign(secret, body_str.encode())
    result = Webhook(secret).verify(body_str, sig)
    assert result == body_str.encode()


def test_whsec_prefix_is_stripped():
    bare = "my-signing-secret"
    body = b'{"event":"user.updated"}'
    sig = sign(bare, body)
    # Same secret prefixed with whsec_ must verify correctly
    Webhook("whsec_" + bare).verify(body, sig)


def test_missing_signature_raises():
    with pytest.raises(WebhookVerificationError, match="missing"):
        Webhook("secret").verify(b"{}", "")


def test_wrong_scheme_raises():
    with pytest.raises(WebhookVerificationError, match="unsupported"):
        Webhook("secret").verify(b"{}", "md5=abc123")


def test_signature_mismatch_raises():
    body = b'{"event":"user.deleted"}'
    sig = sign("correct-secret", body)
    with pytest.raises(WebhookVerificationError, match="mismatch"):
        Webhook("wrong-secret").verify(body, sig)


def test_tampered_body_raises():
    secret = "s3cr3t"
    body = b'{"event":"user.login"}'
    sig = sign(secret, body)
    tampered = b'{"event":"user.deleted"}'
    with pytest.raises(WebhookVerificationError):
        Webhook(secret).verify(tampered, sig)


def test_verify_oneshot_helper():
    secret = "helper-secret"
    body = b'{"event":"token.issued"}'
    sig = sign(secret, body)
    result = verify(secret, sig, body)
    assert result == body


def test_invalid_hex_in_signature_raises():
    # sha256= prefix is correct but the hex digits are invalid
    with pytest.raises(WebhookVerificationError):
        Webhook("secret").verify(b"{}", "sha256=ZZZZnotvalidhex")
