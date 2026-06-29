import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerCIBATools(server: McpServer): void {
  // ── List pending CIBA requests ─────────────────────────────────────────────
  server.registerTool(
    "clavex_ciba_list_pending",
    {
      title: "List Pending CIBA Requests",
      description: `List all pending Client-Initiated Backchannel Authentication (CIBA) requests for an organization.

CIBA decouples the authentication device from the consuming device: a client (e.g. call-centre app)
initiates a backchannel auth; the end-user must approve on a separate channel (e.g. mobile push).

Returns: auth_req_id, login_hint (user email), binding_message, client_id, expires_at.

Use when:
  "show pending CIBA requests for org <id>"
  "which users have pending backchannel auth requests?"
  "approva la richiesta CIBA per Mario Rossi"  ← first call this to get the auth_req_id`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const reqs = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/ciba/pending"),
        );
        if (!Array.isArray(reqs) || reqs.length === 0) return "_No pending CIBA requests._";
        return mdTable(reqs, ["auth_req_id", "login_hint", "binding_message", "client_id", "expires_at", "created_at"]);
      }),
  );

  // ── Approve CIBA request ───────────────────────────────────────────────────
  server.registerTool(
    "clavex_ciba_approve",
    {
      title: "Approve CIBA Request",
      description: `Approve a pending CIBA (backchannel authentication) request on behalf of an admin.

After approval the client polling the token endpoint will receive an access + ID token.
The user_id MUST be the UUID of the authenticated end-user whose identity is being asserted.

Args:
  - org_id: Organization UUID
  - auth_req_id: The auth_req_id returned by the backchannel authorize endpoint (use clavex_ciba_list_pending)
  - user_id: UUID of the user whose identity is confirmed

Returns: confirmation JSON { status: "approved" }.

Use when:
  "approva la richiesta CIBA per Mario Rossi" (after finding auth_req_id via list_pending)
  "approve CIBA request <auth_req_id> for user <user_id>"
  "confirm backchannel authentication"`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        auth_req_id: z.string().describe("CIBA auth_req_id to approve"),
        user_id:     z.string().uuid().describe("UUID of the user whose identity is confirmed"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, auth_req_id, user_id }) =>
      handleError(async () => {
        const result = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, `/ciba/${auth_req_id}/approve`),
          { user_id },
        );
        return `CIBA request ${auth_req_id} approved for user ${user_id}.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Deny CIBA request ──────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ciba_deny",
    {
      title: "Deny CIBA Request",
      description: `Deny a pending CIBA (backchannel authentication) request.

After denial the polling client receives an access_denied error on the next token request.

Args:
  - org_id: Organization UUID
  - auth_req_id: The auth_req_id to deny (use clavex_ciba_list_pending to find it)

Returns: confirmation JSON { status: "denied" }.

Use when:
  "nega la richiesta CIBA <auth_req_id>"
  "deny CIBA request — the user did not initiate this"
  "reject backchannel auth for suspicious request"`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        auth_req_id: z.string().describe("CIBA auth_req_id to deny"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, auth_req_id }) =>
      handleError(async () => {
        const result = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, `/ciba/${auth_req_id}/deny`),
        );
        return `CIBA request ${auth_req_id} denied.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );
}
