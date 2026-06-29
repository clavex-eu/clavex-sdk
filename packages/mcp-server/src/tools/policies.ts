import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerPolicyTools(server: McpServer): void {
  // ── List policies ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_policies",
    {
      title: "List Auth Policies",
      description: `List all auth-flow policy rules for an organization.

Rules are evaluated in priority order (lowest number first) on every login attempt.
Each rule matches conditions (country, IP range, device, time) and applies an action (allow, deny, require_mfa).

Returns: id, name, priority, action, conditions summary, is_active.

Use when: "show auth policies for org <id>", "what geo-blocking rules are active?".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const rules = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/auth-policies"),
        );
        return mdTable(rules, ["id", "name", "priority", "action", "is_active"]);
      }),
  );

  // ── Create policy ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_create_policy",
    {
      title: "Create Auth Policy Rule",
      description: `Create a new auth-flow policy rule for an organization.

Rules control login behavior: blocking countries, requiring MFA, restricting IP ranges.
Rules are evaluated in priority order — lower number = evaluated first.

Args:
  - org_id: Organization UUID
  - name: Rule name (e.g. "Block Russia")
  - priority: Evaluation order (1 = first). Rules with same priority are evaluated in creation order.
  - action: What to do when rule matches:
      "allow"        — permit login (use to create allow-list exceptions before a deny rule)
      "deny"         — block login
      "require_mfa"  — force MFA step
  - conditions: JSON object describing match criteria. Supported fields:
      { "country": ["US", "DE"] }          — match these countries
      { "country_not": ["RU", "CN"] }      — block these countries
      { "ip_cidr": ["10.0.0.0/8"] }        — match IP ranges
      { "ip_cidr_not": ["..."] }           — exclude IP ranges
      { "user_group": ["<group_id>"] }     — match users in group
      Conditions are ANDed together.
  - description (optional): Human-readable explanation

Returns: Created policy rule JSON.

Examples:
  - "block all logins from Russia" → action=deny, conditions={"country":["RU"]}
  - "require MFA for everyone" → action=require_mfa, conditions={}`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        name:        z.string().describe("Rule name"),
        priority:    z.number().int().min(1).describe("Evaluation order (lower = first)"),
        action:      z.enum(["allow", "deny", "require_mfa"]).describe("Action when rule matches"),
        conditions:  z.record(z.unknown()).describe("Match conditions JSON object"),
        description: z.string().optional().describe("Human-readable explanation"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, name, priority, action, conditions, description }) =>
      handleError(async () => {
        const rule = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/auth-policies"),
          { name, priority, action, conditions, description },
        );
        return `Policy rule created:\n\n${JSON.stringify(rule, null, 2)}`;
      }),
  );

  // ── Delete policy ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_delete_policy",
    {
      title: "Delete Auth Policy Rule",
      description: `Delete an auth-flow policy rule. Logins previously affected by this rule will no longer be restricted by it.

Use when: "remove policy rule <id>", "delete the block-russia rule".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        rule_id: z.string().uuid().describe("Policy rule UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ org_id, rule_id }) =>
      handleError(async () => {
        await getClient().del(getClient().orgPath(org_id, `/auth-policies/${rule_id}`));
        return `Policy rule ${rule_id} deleted.`;
      }),
  );

  // ── Simulate policy ────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_simulate_policy",
    {
      title: "Simulate Auth Policy Evaluation",
      description: `Dry-run the auth policy evaluation for a hypothetical login — no actual login occurs.

Useful for testing policy rules: "would this user be blocked if logging in from Russia?"

Args:
  - org_id: Organization UUID
  - user_id (optional): UUID of the user whose groups/attributes to consider
  - ip_address (optional): Simulated IP address
  - country (optional): ISO 3166-1 alpha-2 country code (e.g. "RU", "US")
  - device_type (optional): "mobile" | "desktop"

Returns:
  - outcome.action: "allow" | "deny" | "require_mfa"
  - matched_rule: the first rule that matched (or null if no match → default allow)
  - trace: evaluation trace of all rules checked`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        user_id:     z.string().uuid().optional().describe("User UUID to simulate (considers group memberships)"),
        ip_address:  z.string().optional().describe("Simulated IP address, e.g. 1.2.3.4"),
        country:     z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code, e.g. RU"),
        device_type: z.enum(["mobile", "desktop"]).optional().describe("Device type"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, user_id, ip_address, country, device_type }) =>
      handleError(async () => {
        const body = Object.fromEntries(
          Object.entries({ user_id, ip_address, country, device_type }).filter(([, v]) => v !== undefined),
        );
        const result = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/auth-policies/simulate"),
          body,
        );
        return JSON.stringify(result, null, 2);
      }),
  );

  // ── API Keys ───────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_api_keys",
    {
      title: "List API Keys",
      description: `List all superadmin API keys. API keys are used instead of JWT tokens for machine-to-machine integrations.

Returns: id, name, last_used_at, created_at.
Note: The plaintext secret is never returned after creation.

Use when: "show all API keys", "list service accounts".`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () =>
      handleError(async () => {
        const keys = await getClient().get<Array<Record<string, unknown>>>("/api/v1/admin/api-keys");
        return mdTable(keys, ["id", "name", "last_used_at", "created_at"]);
      }),
  );

  server.registerTool(
    "clavex_create_api_key",
    {
      title: "Create API Key",
      description: `Create a new superadmin API key for machine-to-machine access.

Returns: API key JSON including the one-time plaintext secret.
IMPORTANT: Save the secret immediately — it will never be shown again.

Use when: "create API key for Terraform", "generate service account credentials".`,
      inputSchema: {
        name: z.string().describe("API key name / description, e.g. 'terraform-provisioner'"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ name }) =>
      handleError(async () => {
        const result = await getClient().post<Record<string, unknown>>("/api/v1/admin/api-keys", { name });
        const secret = result.secret ?? result.api_key;
        return `API key created.\n\n⚠️  SAVE THIS SECRET:\nsecret: ${secret}\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  server.registerTool(
    "clavex_delete_api_key",
    {
      title: "Delete API Key",
      description: `Delete a superadmin API key. Any service using it will immediately lose access.

Use when: "revoke API key <id>", "delete the terraform API key".`,
      inputSchema: {
        key_id: z.string().uuid().describe("API key UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ key_id }) =>
      handleError(async () => {
        await getClient().del(`/api/v1/admin/api-keys/${key_id}`);
        return `API key ${key_id} deleted.`;
      }),
  );

  // ── Usage ──────────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_get_usage",
    {
      title: "Get Organization Usage",
      description: `Get current usage metrics for an organization: active users, sessions, API calls.

Use when: "how many users does org <id> have?", "what's the monthly auth volume?".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const usage = await getClient().get<Record<string, unknown>>(
          getClient().orgPath(org_id, "/usage"),
        );
        return JSON.stringify(usage, null, 2);
      }),
  );
}
