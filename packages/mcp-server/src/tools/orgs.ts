import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerOrgTools(server: McpServer): void {
  // ── List orgs ──────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_orgs",
    {
      title: "List Organizations",
      description: `List all organizations in the Clavex instance. Requires superadmin token.

Returns a table with columns: id, slug, name, is_active, created_at.

Use when: "show me all tenants", "list all orgs", "how many organizations are there".`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () =>
      handleError(async () => {
        const orgs = await getClient().get<Array<Record<string, unknown>>>("/api/v1/organizations");
        return mdTable(orgs, ["id", "slug", "name", "is_active", "created_at"]);
      }),
  );

  // ── Get org ────────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_get_org",
    {
      title: "Get Organization",
      description: `Get details of a single organization by its UUID.

Returns full JSON of the org object.

Use when: "get org abc123", "show details of organization <id>".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const org = await getClient().get<Record<string, unknown>>(`/api/v1/organizations/${org_id}`);
        return JSON.stringify(org, null, 2);
      }),
  );

  // ── Create org ─────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_create_org",
    {
      title: "Create Organization",
      description: `Create a new organization (tenant) in Clavex. Requires superadmin.

Args:
  - name (string): Display name for the organization
  - slug (string): URL slug used in auth endpoints (e.g. "acme" → /acme/authorize). Must be unique, lowercase, alphanumeric+hyphens.
  - domain (string, optional): Primary email domain for the org
  - logo_url (string, optional): URL to the org logo

Returns: Created organization JSON.

Use when: "create a new tenant for ACME", "add organization example.com".`,
      inputSchema: {
        name:     z.string().min(2).describe("Display name for the organization"),
        slug:     z.string().regex(/^[a-z0-9-]+$/).describe("URL slug (lowercase, alphanumeric + hyphens)"),
        domain:   z.string().optional().describe("Primary email domain, e.g. acme.com"),
        logo_url: z.string().url().optional().describe("URL to the organization logo"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ name, slug, domain, logo_url }) =>
      handleError(async () => {
        const org = await getClient().post<Record<string, unknown>>("/api/v1/organizations", {
          name, slug, domain, logo_url,
        });
        return `Organization created:\n\n${JSON.stringify(org, null, 2)}`;
      }),
  );

  // ── Update org ─────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_update_org",
    {
      title: "Update Organization",
      description: `Update an organization's settings. All fields are optional (PATCH semantics).

Args:
  - org_id (string): Organization UUID
  - name (string, optional): New display name
  - domain (string, optional): New primary domain
  - logo_url (string, optional): New logo URL
  - is_active (boolean, optional): Enable or disable the organization

Returns: Updated organization JSON.`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        name:      z.string().optional().describe("New display name"),
        domain:    z.string().optional().describe("New primary domain"),
        logo_url:  z.string().url().optional().describe("New logo URL"),
        is_active: z.boolean().optional().describe("Enable or disable the org"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, ...updates }) =>
      handleError(async () => {
        // Remove undefined values
        const body = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined),
        );
        const org = await getClient().patch<Record<string, unknown>>(
          `/api/v1/organizations/${org_id}`,
          body,
        );
        return `Organization updated:\n\n${JSON.stringify(org, null, 2)}`;
      }),
  );
}
