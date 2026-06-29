import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerClientTools(server: McpServer): void {
  // ── List clients ───────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_clients",
    {
      title: "List OIDC Clients",
      description: `List all OIDC/OAuth2 clients registered in an organization.

Returns: client_id, name, grant_types, redirect_uris, is_active.

Use when: "show me all apps registered in org <id>", "list OIDC clients for acme".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const clients = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/clients"),
        );
        return mdTable(clients, ["client_id", "name", "grant_types", "is_active"]);
      }),
  );

  // ── Get client ─────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_get_client",
    {
      title: "Get OIDC Client",
      description: `Get full details of an OIDC/OAuth2 client registration.

Returns full client JSON including redirect URIs, scopes, grant types, and settings.

Note: client_secret is never returned after creation — use clavex_rotate_client_secret to reset it.`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        client_id: z.string().describe("OIDC client_id"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, client_id }) =>
      handleError(async () => {
        const client = await getClient().get<Record<string, unknown>>(
          getClient().orgPath(org_id, `/clients/${client_id}`),
        );
        return JSON.stringify(client, null, 2);
      }),
  );

  // ── Create client ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_create_client",
    {
      title: "Create OIDC Client",
      description: `Register a new OIDC/OAuth2 client in an organization.

Args:
  - org_id: Organization UUID
  - name: Human-readable client name (e.g. "My Web App")
  - redirect_uris: Array of allowed redirect URIs (must be https:// in production)
  - grant_types: Array of allowed grant types. Common values:
      ["authorization_code"] — standard web app
      ["authorization_code", "refresh_token"] — web app with refresh
      ["client_credentials"] — machine-to-machine
  - response_types (optional): defaults to ["code"]
  - scopes (optional): allowed scopes, defaults to ["openid", "profile", "email"]
  - is_public (optional): true for SPAs/mobile apps (no client_secret)
  - post_logout_redirect_uris (optional): allowed logout redirect URIs

Returns: Created client JSON including the one-time plaintext client_secret.
IMPORTANT: Save the client_secret immediately — it will never be shown again.

Use when: "register Grafana as an OIDC client", "add a new web app to acme org".`,
      inputSchema: {
        org_id:                    z.string().uuid().describe("Organization UUID"),
        name:                      z.string().describe("Client display name"),
        redirect_uris:             z.array(z.string().url()).min(1).describe("Allowed redirect URIs"),
        grant_types:               z.array(z.string()).describe('e.g. ["authorization_code","refresh_token"]'),
        response_types:            z.array(z.string()).optional().describe('e.g. ["code"]'),
        scopes:                    z.array(z.string()).optional().describe('e.g. ["openid","profile","email","groups"]'),
        is_public:                 z.boolean().optional().describe("True for SPA/mobile (no client_secret)"),
        post_logout_redirect_uris: z.array(z.string().url()).optional().describe("Allowed post-logout redirect URIs"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, ...params }) =>
      handleError(async () => {
        const result = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/clients"),
          params,
        );
        const secret = result.client_secret
          ? `\n\n⚠️  SAVE THIS SECRET — it will not be shown again:\nclient_secret: ${result.client_secret}`
          : "";
        return `Client registered successfully.${secret}\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Update client ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_update_client",
    {
      title: "Update OIDC Client",
      description: `Update an existing OIDC client registration (PATCH semantics).

Args:
  - org_id, client_id: identifiers
  - name, redirect_uris, grant_types, scopes, is_active (all optional): new values

Returns: Updated client JSON.

Use when: "add a redirect URI to the Grafana client", "disable client <id>".`,
      inputSchema: {
        org_id:                    z.string().uuid().describe("Organization UUID"),
        client_id:                 z.string().describe("OIDC client_id"),
        name:                      z.string().optional().describe("New display name"),
        redirect_uris:             z.array(z.string().url()).optional().describe("New redirect URIs (replaces existing)"),
        post_logout_redirect_uris: z.array(z.string().url()).optional().describe("New logout redirect URIs"),
        scopes:                    z.array(z.string()).optional().describe("New allowed scopes"),
        is_active:                 z.boolean().optional().describe("Enable or disable the client"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, client_id, ...updates }) =>
      handleError(async () => {
        const body = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined),
        );
        const result = await getClient().patch<Record<string, unknown>>(
          getClient().orgPath(org_id, `/clients/${client_id}`),
          body,
        );
        return `Client updated:\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Rotate secret ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_rotate_client_secret",
    {
      title: "Rotate Client Secret",
      description: `Generate a new client_secret for an OIDC client. The old secret is immediately invalidated.

Returns: New plaintext client_secret.
IMPORTANT: Update the secret in your application immediately after rotation.

Use when: "rotate secret for client <id>", "regenerate client credentials".`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        client_id: z.string().describe("OIDC client_id"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, client_id }) =>
      handleError(async () => {
        const result = await getClient().post<{ client_secret: string }>(
          getClient().orgPath(org_id, `/clients/${client_id}/rotate-secret`),
        );
        return `⚠️  New secret (save immediately):\nclient_secret: ${result.client_secret}`;
      }),
  );
}
