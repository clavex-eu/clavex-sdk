# @clavex/webhooks (Node.js / TypeScript)

Webhook signature verification for the [Clavex Identity Platform](https://github.com/fcraviolatti/clavex).

## Installation

```bash
npm install @clavex/webhooks
# or
yarn add @clavex/webhooks
```

## Usage

```typescript
import { Webhook, WebhookVerificationError } from "@clavex/webhooks";

const wh = new Webhook(process.env.CLAVEX_WEBHOOK_SECRET!);

// In your Express handler:
app.post("/webhooks/clavex", express.raw({ type: "*/*" }), (req, res) => {
  try {
    const payload = wh.verify(req.body, req.headers["x-clavex-signature"] as string);
    const event = JSON.parse(payload.toString());
    console.log(event.type); // e.g. "user.created"
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof WebhookVerificationError) return res.sendStatus(400);
    throw err;
  }
});
```

### One-shot helper

```js
const { verify } = require("@clavex/webhooks");

const payload = verify(secret, req.headers["x-clavex-signature"], req.body);
```

## API

### `new Webhook(secret)`

Create a verifier.  `secret` may include the `whsec_` prefix — it is stripped automatically.

### `webhook.verify(body, signature): Buffer`

Verify and return the raw body.  Throws `WebhookVerificationError` on failure.

### `verify(secret, signature, body): Buffer`

Convenience one-shot function.

## Signature format

Clavex sends `X-Clavex-Signature: sha256=<HMAC-SHA256-hex>` computed over the raw request body using your webhook secret.
