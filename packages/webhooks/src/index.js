"use strict";

const crypto = require("crypto");

class WebhookVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

class Webhook {
  /**
   * @param {string} secret  The signing secret (whsec_ prefix is stripped).
   */
  constructor(secret) {
    if (!secret) throw new Error("secret is required");
    this._key = Buffer.from(secret.replace(/^whsec_/, ""), "utf8");
  }

  /**
   * Verify a webhook request.
   *
   * @param {Buffer|string} body       Raw request body.
   * @param {string}        signature  Value of the X-Clavex-Signature header.
   * @returns {Buffer} The raw body on success.
   * @throws {WebhookVerificationError}
   */
  verify(body, signature) {
    if (!signature) throw new WebhookVerificationError("missing signature header");
    if (!signature.startsWith("sha256=")) {
      throw new WebhookVerificationError(`unsupported signature scheme: ${signature.slice(0, 20)}`);
    }

    const received = signature.slice("sha256=".length);
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
    const expected = crypto.createHmac("sha256", this._key).update(raw).digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"))) {
      throw new WebhookVerificationError("signature mismatch");
    }
    return raw;
  }
}

/**
 * One-shot convenience helper.
 *
 * @param {string}        secret
 * @param {string}        signature
 * @param {Buffer|string} body
 * @returns {Buffer}
 */
function verify(secret, signature, body) {
  return new Webhook(secret).verify(body, signature);
}

module.exports = { Webhook, WebhookVerificationError, verify };
