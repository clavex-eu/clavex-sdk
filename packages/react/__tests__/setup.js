// Polyfills for jsdom test environment
const { TextEncoder, TextDecoder } = require("node:util");
const { webcrypto } = require("node:crypto");

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Expose Web Crypto API (needed for PKCE computeCodeChallenge)
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  writable: true,
  configurable: true,
});
