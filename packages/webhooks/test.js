"use strict";

const crypto = require("crypto");
const assert = require("assert/strict");
const { Webhook, WebhookVerificationError, verify } = require("./src/index");

// ── helpers ──────────────────────────────────────────────────────────────────

function sign(secret, body) {
  const raw = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  const hex = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(raw).digest("hex");
  return "sha256=" + hex;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ── Webhook class ─────────────────────────────────────────────────────────────

console.log("\nclavex-webhooks — JS test suite\n");

test("valid signature returns raw body as Buffer", () => {
  const secret = "test-secret-abc";
  const body = '{"event":"user.created","data":{}}';
  const sig = sign(secret, body);
  const wh = new Webhook(secret);
  const result = wh.verify(body, sig);
  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.toString("utf8"), body);
});

test("whsec_ prefix is stripped automatically", () => {
  const bare = "my-signing-secret";
  const body = '{"event":"user.updated"}';
  const sig = sign(bare, body);
  // Pass the same secret with the whsec_ prefix — must still verify
  const wh = new Webhook("whsec_" + bare);
  assert.doesNotThrow(() => wh.verify(body, sig));
});

test("missing signature header throws WebhookVerificationError", () => {
  const wh = new Webhook("secret");
  assert.throws(
    () => wh.verify('{"event":"x"}', ""),
    (err) => err instanceof WebhookVerificationError && /missing/.test(err.message)
  );
});

test("wrong signature scheme throws WebhookVerificationError", () => {
  const wh = new Webhook("secret");
  assert.throws(
    () => wh.verify('{"event":"x"}', "md5=abc123"),
    (err) => err instanceof WebhookVerificationError && /unsupported/.test(err.message)
  );
});

test("wrong secret causes mismatch error", () => {
  const body = '{"event":"user.deleted"}';
  const sig = sign("correct-secret", body);
  const wh = new Webhook("wrong-secret");
  assert.throws(
    () => wh.verify(body, sig),
    (err) => err instanceof WebhookVerificationError && /mismatch/.test(err.message)
  );
});

test("tampered body causes mismatch error", () => {
  const secret = "s3cr3t";
  const body = '{"event":"user.login"}';
  const sig = sign(secret, body);
  const tampered = '{"event":"user.deleted"}';
  const wh = new Webhook(secret);
  assert.throws(
    () => wh.verify(tampered, sig),
    WebhookVerificationError
  );
});

test("verify() one-shot helper works correctly", () => {
  const secret = "helper-secret";
  const body = '{"event":"token.issued"}';
  const sig = sign(secret, body);
  const result = verify(secret, sig, body);
  assert.ok(Buffer.isBuffer(result));
});

test("constructor throws when secret is empty", () => {
  assert.throws(() => new Webhook(""), /required/);
});

test("Buffer body is accepted (no double-encoding)", () => {
  const secret = "buf-secret";
  const body = Buffer.from('{"event":"mfa.enrolled"}', "utf8");
  const sig = sign(secret, body);
  const wh = new Webhook(secret);
  const result = wh.verify(body, sig);
  assert.ok(Buffer.isBuffer(result));
  assert.deepEqual(result, body);
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
