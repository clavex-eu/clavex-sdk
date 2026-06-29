import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerPAMTools(server: McpServer): void {
  // ── List pending PAM access requests ──────────────────────────────────────
  server.registerTool(
    "clavex_pam_list_pending",
    {
      title: "List Pending PAM Access Requests",
      description: `List all pending Privileged Access Management (PAM) JIT access requests for an organization.

Returns: id, resource_name, resource_type, justification, requested_duration (minutes), created_at.

A security engineer approves or denies these using clavex_pam_approve.

Use when:
  "show pending PAM requests"
  "chi ha richiesto accesso privilegiato?"
  "which JIT access requests need approval?"
  "list all open privileged access requests"`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const resp = await getClient().get<{ data: Array<Record<string, unknown>> }>(
          getClient().orgPath(org_id, "/pam/access-requests?status=pending"),
        );
        const items = resp.data ?? [];
        if (!Array.isArray(items) || items.length === 0) {
          return "_No pending PAM access requests._";
        }
        return mdTable(items, [
          "id",
          "resource_name",
          "resource_type",
          "justification",
          "requested_duration",
          "created_at",
        ]);
      }),
  );

  // ── Submit a JIT access request ────────────────────────────────────────────
  server.registerTool(
    "clavex_pam_request",
    {
      title: "Request Privileged Access (PAM JIT)",
      description: `Submit a Just-In-Time (JIT) privileged access request to the PAM system.

The request is routed to the security team for approval.
Once approved, access is active for the requested duration and automatically revoked when it expires.

Args:
  - org_id: Organization UUID
  - resource_name: Human-readable name of the resource (e.g. "prod-db", "k8s-prod-cluster")
  - resource_type: Category — "database" | "server" | "kubernetes" | "api" | "generic"
  - resource_id: Unique identifier (hostname, ARN, UUID, etc.)
  - justification: Why access is needed — be specific (e.g. "deploy hotfix for incident #1234")
  - duration_minutes: Requested access window in minutes (5–480, default 60)

Returns: Created access request JSON — save the id to approve/track it.

Use when:
  "richiedi accesso privilegiato al database prod per 2 ore"
  "request 120-minute access to prod-db — hotfix deploy"
  "submit a PAM JIT request for the Kubernetes cluster"`,
      inputSchema: {
        org_id:           z.string().uuid().describe("Organization UUID"),
        resource_name:    z.string().describe("Human-readable resource name, e.g. 'prod-db'"),
        resource_type:    z
          .enum(["database", "server", "kubernetes", "api", "generic"])
          .default("generic")
          .describe("Resource category"),
        resource_id:      z.string().describe("Unique resource identifier (hostname, ARN, UUID, etc.)"),
        justification:    z
          .string()
          .min(10)
          .describe("Reason for access — be specific, e.g. 'deploy hotfix for incident #1234'"),
        duration_minutes: z
          .number()
          .int()
          .min(5)
          .max(480)
          .default(60)
          .describe("Requested access window in minutes (5–480, default 60)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, resource_name, resource_type, resource_id, justification, duration_minutes }) =>
      handleError(async () => {
        const req = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/pam/access-requests"),
          {
            resource_name,
            resource_type,
            resource_id,
            justification,
            requested_duration: duration_minutes,
          },
        );
        return [
          `PAM access request submitted — status: **pending**`,
          ``,
          `\`\`\`json`,
          JSON.stringify(req, null, 2),
          `\`\`\``,
          ``,
          `Awaiting security team approval.`,
          `Use \`clavex_pam_approve\` with \`request_id: "${req["id"]}"\` to approve or deny.`,
        ].join("\n");
      }),
  );

  // ── Approve or deny a PAM access request ──────────────────────────────────
  server.registerTool(
    "clavex_pam_approve",
    {
      title: "Approve or Deny PAM Access Request",
      description: `Approve or deny a pending Privileged Access Management (PAM) JIT access request.

Approving activates access for the originally requested duration, then auto-revokes it.
Denying rejects the request; the requester cannot use that access window.

Use clavex_pam_list_pending first to get the request IDs awaiting decision.

Args:
  - org_id: Organization UUID
  - request_id: UUID of the PAM access request to decide on
  - decision: "approve" or "deny"
  - note (optional): Message visible to the requester (reason for approval or denial)

Returns: Updated access request JSON — status becomes "active" (approved) or "denied".

Use when:
  "approva la richiesta PAM <id>"
  "approve prod-db request for Alice — confirmed maintenance window"
  "deny PAM request — not an approved change window"
  "nega la richiesta di accesso privilegiato"`,
      inputSchema: {
        org_id:     z.string().uuid().describe("Organization UUID"),
        request_id: z.string().uuid().describe("PAM access request UUID"),
        decision:   z.enum(["approve", "deny"]).describe('"approve" = grant access, "deny" = reject'),
        note:       z.string().optional().describe("Optional note to the requester"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, request_id, decision, note }) =>
      handleError(async () => {
        const endpoint = decision === "approve" ? "approve" : "deny";
        const result = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, `/pam/access-requests/${request_id}/${endpoint}`),
          { note: note ?? "" },
        );
        const emoji = decision === "approve" ? "✅" : "❌";
        const label = decision === "approve" ? "APPROVED — access is now active" : "DENIED";
        return [
          `${emoji} Request \`${request_id}\`: **${label}**`,
          ``,
          `\`\`\`json`,
          JSON.stringify(result, null, 2),
          `\`\`\``,
        ].join("\n");
      }),
  );

  // ── Vault: list credentials ────────────────────────────────────────────────
  server.registerTool(
    "clavex_vault_list_credentials",
    {
      title: "Vault: List Credentials",
      description: `List all credentials stored in the PAM vault for an organization.

Returns: id, name, credential_type, username, target_host, checkout_duration, require_access_request, is_active.
Note: plaintext secrets are never returned in list responses. Use clavex_vault_checkout to retrieve a secret.

Use when:
  "show vault credentials"
  "which credentials are in the PAM vault?"
  "quali credenziali ci sono nel vault?"
  "list SSH keys in the vault"`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const resp = await getClient().get<{ data: Array<Record<string, unknown>> }>(
          getClient().orgPath(org_id, "/pam/credentials"),
        );
        const items = resp.data ?? [];
        if (!Array.isArray(items) || items.length === 0) {
          return "_No vault credentials found._";
        }
        return mdTable(items, [
          "id",
          "name",
          "credential_type",
          "username",
          "target_host",
          "checkout_duration",
          "require_access_request",
          "is_active",
        ]);
      }),
  );

  // ── Vault: checkout credential ─────────────────────────────────────────────
  server.registerTool(
    "clavex_vault_checkout",
    {
      title: "Vault: Checkout Credential",
      description: `Check out a credential from the Clavex PAM vault. Returns the plaintext secret once.

The credential is locked for the checkout duration and automatically released when it expires.
Pass an approved access_request_id when the credential policy requires one.

⚠️  The secret is returned ONCE — store it immediately.
    It will NOT be shown again and access is revoked after the checkout window closes.

Args:
  - org_id: Organization UUID
  - cred_id: UUID of the vault credential (from clavex_vault_list_credentials)
  - reason (optional): Reason for checkout (goes to audit trail)
  - access_request_id (optional): UUID of an approved PAM access request (required if credential policy demands it)

Returns:
  - secret: plaintext credential — save immediately
  - checkout: metadata including expires_at and checkout_id

Use when:
  "checkout prod-db password from vault"
  "ritira le credenziali SSH dalla vault"
  "get the API key for prod deployment — linked to request <id>"`,
      inputSchema: {
        org_id:            z.string().uuid().describe("Organization UUID"),
        cred_id:           z
          .string()
          .uuid()
          .describe("Vault credential UUID (use clavex_vault_list_credentials to find)"),
        reason:            z
          .string()
          .optional()
          .describe("Reason for checkout — recorded in the audit trail"),
        access_request_id: z
          .string()
          .uuid()
          .optional()
          .describe("Approved PAM access request UUID (required when credential policy demands it)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, cred_id, reason, access_request_id }) =>
      handleError(async () => {
        const body: Record<string, unknown> = {};
        if (reason)            body["reason"] = reason;
        if (access_request_id) body["access_request_id"] = access_request_id;

        const result = await getClient().post<{
          checkout: Record<string, unknown>;
          secret:   string;
          warning:  string;
        }>(
          getClient().orgPath(org_id, `/pam/credentials/${cred_id}/checkout`),
          body,
        );

        return [
          `⚠️  **${result.warning}**`,
          ``,
          `**Secret:** \`${result.secret}\``,
          ``,
          `**Checkout details:**`,
          `\`\`\`json`,
          JSON.stringify(result.checkout, null, 2),
          `\`\`\``,
        ].join("\n");
      }),
  );
}
