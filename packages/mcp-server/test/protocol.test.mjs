import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

const org = "11111111-1111-4111-8111-111111111111";

test("MCP exposes migrated schemas and rejects invalid arguments before HTTP", async (t) => {
  const server = createServer();
  const client = new Client({name: "test-client", version: "1.0.0"});
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  const result = await client.listTools();
  assert(result.tools.length > 20);
  const anomaly = result.tools.find(tool => tool.name === "clavex_ai_explain_anomaly");
  assert.equal(anomaly.inputSchema.properties.signals.type, "object");
  let requests = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { requests++; throw new Error("Unexpected HTTP request"); };
  t.after(() => { globalThis.fetch = previousFetch; });
  const invalid = await client.callTool({name: "clavex_list_clients", arguments: {org_id: "not-a-uuid"}});
  assert.equal(invalid.isError, true);
  assert.equal(requests, 0);
  const invalidRecord = await client.callTool({name: "clavex_ai_explain_anomaly", arguments: {org_id: org, signals: []}});
  assert.equal(invalidRecord.isError, true);
  assert.equal(requests, 0);

  const saved = {base: process.env.CLAVEX_BASE_URL, token: process.env.CLAVEX_TOKEN};
  process.env.CLAVEX_BASE_URL = "https://issuer.invalid";
  process.env.CLAVEX_TOKEN = "test-only";
  t.after(() => {
    if (saved.base === undefined) delete process.env.CLAVEX_BASE_URL; else process.env.CLAVEX_BASE_URL = saved.base;
    if (saved.token === undefined) delete process.env.CLAVEX_TOKEN; else process.env.CLAVEX_TOKEN = saved.token;
  });
  let sent;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `https://issuer.invalid/api/v1/organizations/${org}/ai/explain-anomaly`);
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({summary: "test explanation"}), {headers: {"Content-Type": "application/json"}});
  };
  const valid = await client.callTool({name: "clavex_ai_explain_anomaly", arguments: {org_id: org, signals: {risk_score: 85, new_country: true}}});
  assert.notEqual(valid.isError, true);
  assert.deepEqual(sent, {signals: {risk_score: 85, new_country: true}});
});
