export class WebhookVerificationError extends Error {
  name: "WebhookVerificationError";
}

export class Webhook {
  constructor(secret: string);
  verify(body: Buffer | string, signature: string): Buffer;
}

export function verify(secret: string, signature: string, body: Buffer | string): Buffer;
