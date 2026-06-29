# clavex-webhooks (Python)

Webhook signature verification for the [Clavex Identity Platform](https://github.com/fcraviolatti/clavex).

## Installation

```bash
pip install clavex-webhooks
```

## Usage

```python
from clavex_webhooks import Webhook, WebhookVerificationError

wh = Webhook("whsec_your_signing_secret")

# In your HTTP handler:
try:
    payload = wh.verify(
        body=request.body,                                # raw bytes or str
        signature=request.headers["X-Clavex-Signature"], # sha256=<hex>
    )
except WebhookVerificationError as exc:
    return Response(str(exc), status=400)

import json
event = json.loads(payload)
print(event["type"])  # e.g. "user.created"
```

### Django / Flask example

```python
# Django
@csrf_exempt
def webhook(request):
    wh = Webhook(settings.CLAVEX_WEBHOOK_SECRET)
    try:
        payload = wh.verify(request.body, request.headers.get("X-Clavex-Signature", ""))
    except WebhookVerificationError:
        return HttpResponse(status=400)
    handle_event(json.loads(payload))
    return HttpResponse(status=200)
```

## API

### `Webhook(secret)`

Create a verifier.  `secret` may include the `whsec_` prefix — it is stripped automatically.

### `webhook.verify(body, signature) → bytes`

Verify and return the raw body.  Raises `WebhookVerificationError` on failure.

### `verify(secret, signature, body) → bytes`

Convenience one-shot function.

## Signature format

Clavex sends `X-Clavex-Signature: sha256=<HMAC-SHA256-hex>` computed over the raw request body using your webhook secret.
