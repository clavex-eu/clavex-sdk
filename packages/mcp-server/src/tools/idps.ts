import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerIDPTools(server: McpServer): void {
  // ── List IdPs ──────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_idps",
    {
      title: "List Identity Providers",
      description: `List all external identity providers (OIDC federation, SAML, social) configured in an organization.

Returns: id, provider_type, name, issuer, is_active.

Use when: "what SSO providers does org <id> have?", "list identity providers for acme".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const idps = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/identity-providers"),
        );
        return mdTable(idps, ["id", "provider_type", "name", "issuer", "is_active"]);
      }),
  );

  // ── Get IdP ────────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_get_idp",
    {
      title: "Get Identity Provider",
      description: `Get full configuration details of an identity provider.

Use when: "show IdP config for <id>", "what are the SAML settings for this org?".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        idp_id: z.string().uuid().describe("Identity Provider UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, idp_id }) =>
      handleError(async () => {
        const idp = await getClient().get<Record<string, unknown>>(
          getClient().orgPath(org_id, `/identity-providers/${idp_id}`),
        );
        return JSON.stringify(idp, null, 2);
      }),
  );

  // ── Webhooks ───────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_webhooks",
    {
      title: "List Webhooks",
      description: `List all webhook endpoints registered in an organization.

Returns: id, url, event_types, is_active.

Use when: "show webhooks for org <id>", "what events does acme receive?".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const hooks = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/webhooks"),
        );
        return mdTable(hooks, ["id", "url", "event_types", "is_active"]);
      }),
  );

  server.registerTool(
    "clavex_create_webhook",
    {
      title: "Create Webhook",
      description: `Register a webhook endpoint to receive Clavex identity events.

Args:
  - org_id: Organization UUID
  - url: HTTPS endpoint that will receive webhook POSTs
  - event_types: Array of event types to subscribe to. Common values:
      "user.created", "user.updated", "user.deleted",
      "session.created", "session.revoked",
      "org.updated"
  - description (optional): Label for the webhook

Returns: Created webhook JSON with signing secret.
IMPORTANT: Save the signing_secret — used to verify webhook signatures (HMAC-SHA256).

Use when: "add a webhook to notify my app on user.created", "set up event delivery to <url>".`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        url:         z.string().url().describe("HTTPS endpoint URL"),
        event_types: z.array(z.string()).describe('Events to subscribe to, e.g. ["user.created"]'),
        description: z.string().optional().describe("Human-readable label"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, url, event_types, description }) =>
      handleError(async () => {
        const hook = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/webhooks"),
          { url, event_types, description },
        );
        const secret = hook.signing_secret
          ? `\n\n⚠️  SAVE THIS SIGNING SECRET:\nsigning_secret: ${hook.signing_secret}`
          : "";
        return `Webhook created.${secret}\n\n${JSON.stringify(hook, null, 2)}`;
      }),
  );

  server.registerTool(
    "clavex_delete_webhook",
    {
      title: "Delete Webhook",
      description: `Delete a webhook endpoint. No more events will be delivered to its URL.

Use when: "remove webhook <id>", "unsubscribe endpoint from events".`,
      inputSchema: {
        org_id:     z.string().uuid().describe("Organization UUID"),
        webhook_id: z.string().uuid().describe("Webhook UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ org_id, webhook_id }) =>
      handleError(async () => {
        await getClient().del(getClient().orgPath(org_id, `/webhooks/${webhook_id}`));
        return `Webhook ${webhook_id} deleted.`;
      }),
  );
}
