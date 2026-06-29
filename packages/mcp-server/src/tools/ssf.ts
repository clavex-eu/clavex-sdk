import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerSSFTools(server: McpServer): void {
  // ── List SSF streams ───────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ssf_list_streams",
    {
      title: "List Shared Signals Framework (SSF) Streams",
      description: `List all Shared Signals Framework (SSF) event delivery streams for an organization.

SSF (OpenID Shared Signals Framework) enables real-time propagation of security events
(CAEP / RISC) to relying parties — e.g. revoking sessions across all connected apps when
a user's credentials are compromised.

Stream delivery methods:
  "push" — Clavex POSTs Security Event Tokens (SETs) to the receiver's endpoint
  "poll" — The receiver polls Clavex to retrieve queued SETs

Returns: stream_id, delivery_method, endpoint_url, enabled, event_types, last_delivery_status.

Use when:
  "list SSF streams for org <id>"
  "which relying parties receive security events?"
  "mostra i canali di segnalazione eventi di sicurezza"`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const streams = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/ssf/streams"),
        );
        if (!Array.isArray(streams) || streams.length === 0) {
          return "_No SSF streams configured for this organization._";
        }
        return mdTable(streams, ["id", "delivery_method", "endpoint_url", "enabled", "event_types_requested"]);
      }),
  );

  // ── Disable SSF stream ────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ssf_disable_stream",
    {
      title: "Disable SSF Stream",
      description: `Disable an SSF event delivery stream so no more SETs are pushed or queued.

Use this to temporarily pause security event delivery without deleting the stream configuration.
Re-enable by calling the PATCH stream endpoint with enabled=true.

Args:
  - org_id: Organization UUID
  - stream_id: UUID of the SSF stream to disable

Use when:
  "disable SSF stream <id>"
  "stop sending security events to <endpoint>"
  "pause event delivery for this relying party"`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        stream_id: z.string().uuid().describe("SSF stream UUID to disable"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, stream_id }) =>
      handleError(async () => {
        // The SSF stream is identified by the client (stream is scoped to client credentials).
        // Admin streams list endpoint returns streams with their IDs.
        // We use the admin PATCH stream endpoint — stream is identified by the client's stream config.
        // Since the admin endpoint manages streams by org, we patch using the standard SSF stream API.
        const result = await getClient().patch<Record<string, unknown>>(
          getClient().orgPath(org_id, `/ssf/streams/${stream_id}`),
          { status: "paused" },
        );
        return `SSF stream ${stream_id} disabled.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );
}
