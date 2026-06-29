import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError } from "../helpers.js";

export function registerFGATools(server: McpServer): void {
  // ── Check relationship ─────────────────────────────────────────────────────
  server.registerTool(
    "clavex_fga_check",
    {
      title: "FGA Relationship Check",
      description: `Check whether a user has a specific relationship to an object in the Fine-Grained Authorization (FGA) store.

Uses Google Zanzibar–style ReBAC (Relationship-Based Access Control) via OpenFGA.

Args:
  - org_id: Organization UUID (must have a provisioned FGA store)
  - user: Subject identifier, e.g. "user:alice-uuid" or "team:engineering"
  - relation: Relation to check, e.g. "can_read", "owner", "member", "viewer"
  - object: Object identifier, e.g. "document:budget-2025", "project:phoenix"

Returns: { allowed: true|false }

Use when:
  "can user alice read document budget-2025?"
  "does team:engineering have owner access on project:phoenix?"
  "verifica se l'utente <id> può approvare il documento <id>"`,
      inputSchema: {
        org_id:   z.string().uuid().describe("Organization UUID"),
        user:     z.string().describe("Subject — e.g. 'user:alice-uuid' or 'team:engineering'"),
        relation: z.string().describe("Relation to check — e.g. 'can_read', 'owner', 'member'"),
        object:   z.string().describe("Object — e.g. 'document:budget-2025'"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, user, relation, object }) =>
      handleError(async () => {
        const result = await getClient().post<{ allowed: boolean }>(
          getClient().orgPath(org_id, "/fga/check"),
          { user, relation, object },
        );
        const verdict = result.allowed ? "✅ **ALLOWED**" : "❌ **DENIED**";
        return `${verdict}\n\n\`${user}\` **${relation}** \`${object}\` → \`allowed: ${result.allowed}\``;
      }),
  );

  // ── Write relationship tuple ────────────────────────────────────────────────
  server.registerTool(
    "clavex_fga_write_tuple",
    {
      title: "FGA Write Relationship Tuple",
      description: `Create or delete a relationship tuple in the FGA store.

Tuples express facts like "user:alice is owner of document:budget-2025".
Creating a tuple grants the relationship; deleting it removes the permission.

Args:
  - org_id: Organization UUID
  - user: Subject — e.g. "user:alice-uuid", "team:engineering"
  - relation: Relation — e.g. "owner", "viewer", "member", "can_approve"
  - object: Object — e.g. "document:budget-2025", "project:phoenix"
  - delete: Pass true to remove the relationship (default: false = create)

Returns: Confirmation message.

Use when:
  "grant user alice viewer access to document:budget-2025"
  "add team:engineering as member of project:phoenix"
  "revoke bob's owner access on document:payroll"
  "concedi a <user> il ruolo <relation> su <object>"`,
      inputSchema: {
        org_id:   z.string().uuid().describe("Organization UUID"),
        user:     z.string().describe("Subject — e.g. 'user:alice-uuid'"),
        relation: z.string().describe("Relation — e.g. 'owner', 'viewer', 'member'"),
        object:   z.string().describe("Object — e.g. 'document:budget-2025'"),
        delete:   z.boolean().default(false).describe("Set true to REMOVE the relationship (default: false = create)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, user, relation, object, delete: del }) =>
      handleError(async () => {
        const body = del
          ? { deletes: [{ user, relation, object }] }
          : { writes:  [{ user, relation, object }] };

        await getClient().post(getClient().orgPath(org_id, "/fga/write"), body);

        const action = del ? "deleted" : "created";
        return `Relationship tuple ${action}: \`${user}\` **${relation}** \`${object}\``;
      }),
  );

  // ── Read relationship tuples ───────────────────────────────────────────────
  server.registerTool(
    "clavex_fga_read_tuples",
    {
      title: "FGA Read Relationship Tuples",
      description: `Read relationship tuples from the FGA store, optionally filtered by user, relation, and/or object.

All three filters are optional — pass only the ones you want to filter on (partial match).

Args:
  - org_id: Organization UUID
  - user (optional): Filter by subject — e.g. "user:alice-uuid"
  - relation (optional): Filter by relation — e.g. "owner"
  - object (optional): Filter by object type or instance — e.g. "document:" or "document:budget-2025"
  - page_size (optional): Max results per page (default: 50)

Returns: Table of matching tuples.

Use when:
  "list all tuples for user alice"
  "what permissions does team:engineering have?"
  "show all owners of document:payroll"
  "elenca i diritti dell'utente <id>"`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        user:      z.string().optional().describe("Filter by subject (partial match ok)"),
        relation:  z.string().optional().describe("Filter by relation"),
        object:    z.string().optional().describe("Filter by object or object type prefix"),
        page_size: z.number().int().min(1).max(100).default(50).describe("Max results (1-100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, user, relation, object, page_size }) =>
      handleError(async () => {
        const params = new URLSearchParams();
        if (user)      params.set("user", user);
        if (relation)  params.set("relation", relation);
        if (object)    params.set("object", object);
        if (page_size) params.set("page_size", String(page_size));

        const path = getClient().orgPath(org_id, `/fga/read?${params.toString()}`);
        const result = await getClient().get<{ tuples: Array<{ key: { user: string; relation: string; object: string } }> }>(path);

        const tuples = (result.tuples ?? []).map((t) => ({
          user: t.key.user,
          relation: t.key.relation,
          object: t.key.object,
        }));

        if (tuples.length === 0) return "_No matching tuples found._";

        const rows = tuples.map((t) => `| \`${t.user}\` | **${t.relation}** | \`${t.object}\` |`).join("\n");
        return `| User | Relation | Object |\n| --- | --- | --- |\n${rows}`;
      }),
  );
}
