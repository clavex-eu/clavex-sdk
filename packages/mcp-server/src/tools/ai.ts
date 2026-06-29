import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError } from "../helpers.js";

export function registerAITools(server: McpServer): void {
  // ── AI config ──────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_configure",
    {
      title: "Configure Anthropic API Key",
      description: `Set or clear the Anthropic API key for AI-assisted admin features in an organization.

AI features require a valid Anthropic API key (starts with 'sk-ant-').
The key is stored securely and used only for server-side AI calls (never exposed to end-users).

Once configured, these AI features become available:
  - clavex_ai_suggest_policy        — NL → auth-flow policy JSON
  - clavex_ai_suggest_fga_model     — NL → OpenFGA authorization model
  - clavex_ai_explain_anomaly       — risk signals → NL explanation (NIS2)
  - clavex_ai_audit_query           — natural language → audit log search
  - clavex_ai_suggest_access_review — pre-fill keep/revoke decisions
  - clavex_ai_suggest_lifecycle_rule — NL → JML lifecycle rule JSON
  - clavex_ai_suggest_dpia          — processing activity → GDPR Art.35 DPIA

Args:
  - org_id: Organization UUID
  - anthropic_api_key: The key (sk-ant-...). Pass null or "" to remove the key.

Use when: "configure Anthropic key for org <id>", "set AI key to sk-ant-..."`,
      inputSchema: {
        org_id:            z.string().uuid().describe("Organization UUID"),
        anthropic_api_key: z.string().nullable().describe("Anthropic API key (sk-ant-...) — null to clear"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, anthropic_api_key }) =>
      handleError(async () => {
        const result = await getClient().put<{ configured: boolean }>(
          getClient().orgPath(org_id, "/ai/config"),
          { anthropic_api_key },
        );
        return result.configured
          ? "Anthropic API key configured successfully. AI features are now enabled."
          : "Anthropic API key cleared. AI features are disabled.";
      }),
  );

  // ── Suggest policy ─────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_suggest_policy",
    {
      title: "AI: Suggest Auth-Flow Policy",
      description: `Convert a natural language access control requirement into a Clavex auth-flow policy JSON.

The AI (Claude Opus 4.7) produces a structured policy with rules, conditions, and actions.
You can review the result and optionally save it via clavex_create_policy.

Requires an Anthropic API key — configure via clavex_ai_configure.

Examples:
  "block logins from Russia and China"
  "require MFA for all admin users outside office hours"
  "allow only users from Italy, Germany and France; block everyone else"
  "deny logins from IP ranges 185.0.0.0/8 and 45.0.0.0/8"

Args:
  - org_id: Organization UUID
  - description: Natural language description of the access control requirement`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        description: z.string().describe("Natural language description of the policy requirement"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, description }) =>
      handleError(async () => {
        const result = await getClient().post<{ policy?: unknown; raw?: string; error?: string }>(
          getClient().orgPath(org_id, "/ai/suggest-policy"),
          { description },
        );
        if (result.error) {
          return `⚠️ AI returned non-JSON output. Review and adjust the description.\n\nRaw output:\n${result.raw}`;
        }
        return `Suggested policy:\n\n\`\`\`json\n${JSON.stringify(result.policy, null, 2)}\n\`\`\`\n\nUse \`clavex_create_policy\` to save individual rules from this policy.`;
      }),
  );

  // ── Suggest FGA model ──────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_suggest_fga_model",
    {
      title: "AI: Generate OpenFGA Authorization Model",
      description: `Convert a natural language description of access control requirements into an OpenFGA 1.1 authorization model JSON.

Use this to bootstrap a Zanzibar-style ReBAC model without learning the OpenFGA schema syntax.
The result can be imported via clavex_fga_write_tuple after uploading the model.

Requires an Anthropic API key — configure via clavex_ai_configure.

Examples:
  "A document management system: owners can read and write; editors can write; viewers can only read"
  "A multi-tenant SaaS: org admins manage members; members access resources in their org only"
  "GitHub-style: repo owners grant write/read to teams; teams inherit from org membership"

Args:
  - org_id: Organization UUID
  - description: Natural language description of the access control structure`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        description: z.string().describe("Natural language description of the authorization model"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, description }) =>
      handleError(async () => {
        const result = await getClient().post<{ model?: unknown; raw?: string; error?: string }>(
          getClient().orgPath(org_id, "/ai/suggest-fga-model"),
          { description },
        );
        if (result.error) {
          return `⚠️ AI returned non-JSON output.\n\nRaw output:\n${result.raw}`;
        }
        return `Generated OpenFGA authorization model:\n\n\`\`\`json\n${JSON.stringify(result.model, null, 2)}\n\`\`\`\n\nUse \`PUT /fga/model\` or the FGA console to upload this model.`;
      }),
  );

  // ── Explain anomaly ────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_explain_anomaly",
    {
      title: "AI: Explain Risk Anomaly (NIS2)",
      description: `Explain a login risk anomaly in natural language, suitable for NIS2 Art.21 security reporting.

Provide the risk signals from a login event; the AI produces a human-readable summary
and detailed explanation for security teams, plus a suggested action.

Requires an Anthropic API key — configure via clavex_ai_configure.

Args:
  - org_id: Organization UUID
  - signals: JSON object with risk signals, e.g.:
      { "risk_score": 85, "country": "RU", "new_country": true, "user_email": "alice@example.com",
        "ip": "185.22.1.1", "user_agent": "...", "is_tor": false, "abuseipdb_score": 67 }`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        signals: z.record(z.unknown()).describe("Risk signals object from a login event"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, signals }) =>
      handleError(async () => {
        const result = await getClient().post<{
          summary?: string;
          explanation?: string;
          suggested_action?: string;
          confidence?: string;
        }>(
          getClient().orgPath(org_id, "/ai/explain-anomaly"),
          { signals },
        );
        const lines = [
          `**Summary:** ${result.summary ?? "—"}`,
          `**Suggested action:** \`${result.suggested_action ?? "—"}\` (confidence: ${result.confidence ?? "—"})`,
          `\n**Explanation:**\n${result.explanation ?? "—"}`,
        ];
        return lines.join("\n");
      }),
  );

  // ── NL audit query ─────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_audit_query",
    {
      title: "AI: Natural Language Audit Log Query",
      description: `Search the audit log using plain natural language. The AI translates your question into structured query filters and executes the search.

No need to know the exact filter parameters — just describe what you're looking for.

Requires an Anthropic API key — configure via clavex_ai_configure.

Examples:
  "show all failed logins in the last 24 hours"
  "which admin created the most users this week?"
  "find all MFA enrollment events for alice@example.com"
  "show me password resets from last month"
  "list all SCIM provisioning failures"

Args:
  - org_id: Organization UUID
  - query: Natural language question about the audit log`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        query:  z.string().describe("Natural language audit question, e.g. 'show failed logins today'"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, query }) =>
      handleError(async () => {
        const result = await getClient().post<{
          nl_query: string;
          applied_filter: Record<string, unknown>;
          results: { events: Array<Record<string, unknown>>; next_cursor?: number };
        }>(
          getClient().orgPath(org_id, "/ai/nl-audit-query"),
          { query },
        );
        const events = result.results?.events ?? [];
        const filterStr = JSON.stringify(result.applied_filter, null, 2);
        if (events.length === 0) {
          return `No audit events found.\n\nApplied filter:\n\`\`\`json\n${filterStr}\n\`\`\``;
        }
        const rows = events
          .map((e) => `| ${e.action ?? "—"} | ${e.actor_email ?? "—"} | ${e.resource_type ?? "—"} | ${e.status ?? "—"} | ${String(e.created_at ?? "—").substring(0, 19)} |`)
          .join("\n");
        return `Found **${events.length}** events.\n\nApplied filter: \`${JSON.stringify(result.applied_filter)}\`\n\n| Action | Actor | Resource | Status | Timestamp |\n| --- | --- | --- | --- | --- |\n${rows}`;
      }),
  );

  // ── Suggest access review ──────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_suggest_access_review",
    {
      title: "AI: Pre-fill Access Review Decisions",
      description: `Analyze pending access review items and suggest keep/revoke decisions with reasoning.

The AI evaluates each (user, role) pair and suggests whether access should be retained or revoked,
based on role sensitivity and other context. This pre-fills reviewer decisions to speed up campaigns.

Requires an Anthropic API key — configure via clavex_ai_configure.

Args:
  - org_id: Organization UUID
  - campaign_id: Access review campaign UUID (use clavex_list_access_reviews to find it)

Returns: JSON array of suggestions with item_id, suggestion (keep/revoke), and reason.`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        campaign_id: z.string().uuid().describe("Campaign UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, campaign_id }) =>
      handleError(async () => {
        const result = await getClient().post<{
          campaign_id: string;
          item_count: number;
          suggestions: Array<{ item_id: string; suggestion: string; reason: string }>;
        }>(
          getClient().orgPath(org_id, "/ai/suggest-access-review"),
          { campaign_id },
        );
        const suggestions = result.suggestions ?? [];
        if (suggestions.length === 0) {
          return "No pending items to review in this campaign.";
        }
        const lines = suggestions.map(
          (s) => `- **${s.item_id}** → \`${s.suggestion.toUpperCase()}\`: ${s.reason}`,
        );
        return `AI suggestions for **${result.item_count}** pending items:\n\n${lines.join("\n")}`;
      }),
  );

  // ── Suggest lifecycle rule ─────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_suggest_lifecycle_rule",
    {
      title: "AI: Generate JML Lifecycle Rule",
      description: `Convert a natural language description into a Clavex JML (Joiner/Mover/Leaver) lifecycle rule JSON.

Lowers the barrier for HR/IT admins to automate provisioning without knowing the rule syntax.

Requires an Anthropic API key — configure via clavex_ai_configure.

Examples:
  "When a new user joins Engineering, give them the Developer role and add them to the Dev-Tools group"
  "When someone's job title changes to Manager, assign them the Team-Lead role"
  "When a user is deactivated, revoke all their roles immediately"
  "When SCIM deprovisions a user, remove them from all groups"

Args:
  - org_id: Organization UUID
  - description: Natural language description of the automation rule`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        description: z.string().describe("Natural language description of the JML automation"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, description }) =>
      handleError(async () => {
        const result = await getClient().post<{ rule?: unknown; raw?: string; error?: string }>(
          getClient().orgPath(org_id, "/ai/suggest-lifecycle-rule"),
          { description },
        );
        if (result.error) {
          return `⚠️ AI returned non-JSON output.\n\nRaw output:\n${result.raw}`;
        }
        return `Generated lifecycle rule:\n\n\`\`\`json\n${JSON.stringify(result.rule, null, 2)}\n\`\`\`\n\nUse \`POST /lifecycle-rules\` or the admin console to save this rule.`;
      }),
  );

  // ── Suggest DPIA ───────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_suggest_dpia",
    {
      title: "AI: Generate GDPR Art.35 DPIA Draft",
      description: `Generate a GDPR Article 35 Data Protection Impact Assessment (DPIA) draft from a processing activity description.

The AI produces a structured DPIA covering: purposes, legal basis, data categories, risks, mitigations,
technical/organisational measures, and DPO consultation requirements.

Particularly useful for DPOs who need to quickly draft DPIAs for new processing activities.
The output JSON can be rendered as a formatted document or reviewed interactively.

Requires an Anthropic API key — configure via clavex_ai_configure.

Args:
  - org_id: Organization UUID
  - description: Description of the data processing activity to assess`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        description: z.string().describe("Description of the data processing activity (who, what, why, how)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, description }) =>
      handleError(async () => {
        const result = await getClient().post<{ dpia?: Record<string, unknown>; raw?: string }>(
          getClient().orgPath(org_id, "/ai/suggest-dpia"),
          { description },
        );
        if (!result.dpia) {
          return `Raw DPIA output:\n${result.raw}`;
        }
        const d = result.dpia;
        const risks = (d.risks as Array<Record<string, string>> ?? [])
          .map((r) => `  - ${r.risk} (likelihood: ${r.likelihood}, severity: ${r.severity}) → ${r.mitigation}`)
          .join("\n");
        return [
          `# ${d.title}`,
          `**Status:** ${d.status} · **Residual risk:** \`${d.residual_risk}\``,
          `**DPO consultation required:** ${d.dpo_consultation_required ? "Yes ⚠️" : "No"}`,
          "",
          `## Processing Activity\n${d.processing_activity}`,
          `## Legal Basis\n${d.legal_basis}`,
          `## Data Categories\n${(d.data_categories as string[] ?? []).join(", ")}`,
          `## Risks\n${risks}`,
          "",
          `\`\`\`json\n${JSON.stringify(d, null, 2)}\n\`\`\``,
        ].join("\n");
      }),
  );

  // ── Explain error ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_ai_explain_error",
    {
      title: "AI: Explain OAuth2/OIDC Error",
      description: `Explain an OAuth2/OIDC/identity protocol error code in plain language.

The AI decodes cryptic error codes (invalid_request, invalid_grant, access_denied, interaction_required, etc.)
with context-aware explanations, likely root causes, fix steps, and RFC/spec references.

Perfect for developers integrating OIDC/OAuth2 who receive opaque errors from the token endpoint,
PAR endpoint, OID4VCI credential endpoint, or other identity flows.

Requires an Anthropic API key — configure via clavex_ai_configure.

Args:
  - org_id: Organization UUID
  - code: OAuth2/OIDC error code (e.g. invalid_request, invalid_grant, access_denied)
  - context: Where the error occurred (e.g. "PAR endpoint", "refresh token exchange", "FAPI 2.0")
  - description: Optional raw error_description string from the server response
  - lang: Optional BCP-47 language code for the response`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        code:        z.string().describe("OAuth2/OIDC error code, e.g. invalid_request"),
        context:     z.string().optional().describe("Context where the error occurred, e.g. 'PAR endpoint'"),
        description: z.string().optional().describe("Raw error_description string from the response"),
        lang:        z.string().optional().describe("Response language BCP-47 code, e.g. it, fr, de"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, code, context, description, lang }) =>
      handleError(async () => {
        const result = await getClient().post<{
          code?: string;
          explanation?: string;
          likely_cause?: string;
          how_to_fix?: string[];
          references?: string[];
          raw?: string;
        }>(
          getClient().orgPath(org_id, "/ai/explain-error"),
          { code, context, description, lang },
        );
        if (result.raw) return result.raw;
        const lines = [
          `## Error: \`${result.code ?? code}\``,
          ...(context ? [`**Context:** ${context}`] : []),
          "",
          `**Explanation:** ${result.explanation ?? "—"}`,
          "",
          `**Likely cause:** ${result.likely_cause ?? "—"}`,
        ];
        if (result.how_to_fix?.length) {
          lines.push("", "**How to fix:**");
          result.how_to_fix.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
        }
        if (result.references?.length) {
          lines.push("", `**References:** ${result.references.join(" · ")}`);
        }
        return lines.join("\n");
      }),
  );

  // ── Audit Copilot ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_audit_copilot",
    {
      title: "AI Audit Copilot — Compliance Query",
      description: `Query the Clavex audit log in plain natural language. The AI generates SQL, executes it read-only, and returns results with a compliance interpretation.

Unlike the basic audit query tool, the Audit Copilot:
  - Generates full SQL (JOINs, aggregations, GROUP BY, complex filters)
  - Has access to PAM resources, session tables, and user data
  - Returns an AI compliance interpretation of the results
  - Accepts additional context (approved user lists, resource names, policies)

Designed for auditors and CISOs who need compliance answers without writing SQL.

Requires an Anthropic API key — configure via clavex_ai_configure.

Examples:
  "PAM accesses to production resources in the last 48h from non-approved users"
  "failed login attempts per country this week"
  "users who enrolled MFA today but also had a failed login"
  "break-glass activations last 30 days with approver names"

Args:
  - org_id: Organization UUID
  - query: Natural language compliance question
  - context: Optional extra context (approved users, production resource names, policies)
  - lang: Optional BCP-47 language code for the interpretation`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        query:   z.string().describe("Natural language compliance question about the audit log"),
        context: z.string().optional().describe("Additional context: approved users, resource names, etc."),
        lang:    z.string().optional().describe("Response language BCP-47 code, e.g. it, fr, de"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, query, context, lang }) =>
      handleError(async () => {
        const result = await getClient().post<{
          query: string;
          generated_sql: string;
          columns: string[];
          results: Array<Record<string, unknown>>;
          row_count: number;
          interpretation: string;
          error?: string;
          detail?: string;
        }>(
          getClient().orgPath(org_id, "/ai/audit-copilot"),
          { query, context, lang },
        );
        if (result.error) {
          return `**Error:** ${result.error}\n${result.detail ? `Detail: ${result.detail}\n` : ""}${result.generated_sql ? `\n\`\`\`sql\n${result.generated_sql}\n\`\`\`` : ""}`;
        }
        const lines: string[] = [
          `**Query:** ${result.query}`,
          `\`\`\`sql\n${result.generated_sql}\n\`\`\``,
        ];
        if (result.row_count === 0) {
          lines.push("No results found.");
        } else {
          const cols = result.columns ?? [];
          lines.push(
            `| ${cols.join(" | ")} |`,
            `| ${cols.map(() => "---").join(" | ")} |`,
            ...result.results.map((row) => `| ${cols.map((c) => String(row[c] ?? "—")).join(" | ")} |`),
            `\n**${result.row_count} row(s)**`,
          );
        }
        if (result.interpretation) {
          lines.push(`\n**Analysis:** ${result.interpretation}`);
        }
        return lines.join("\n");
      }),
  );

  // ── Generate DCQL ──────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_generate_dcql",
    {
      title: "AI: Generate OID4VP DCQL Query from Natural Language",
      description: `Convert a natural language verifier requirement into a valid OID4VP DCQL (Digital Credentials Query Language) query.

DCQL (OID4VP §6) is the eIDAS 2 / EUDIW ARF 1.4 standard for expressing what credentials and claims
a verifier wants to receive from a holder wallet. It replaces the verbose Presentation Exchange format.

This tool lets verifier developers describe what they want to check in plain Italian, English, or any
language — without needing to know the DCQL schema, VCT URIs, mDL namespaces, or claim paths.

Supports EU credential types:
  - EU PID (Person Identification Data — all member states)
  - Italian PID (SPID / CIE — urn:eu.europa.ec.eudi.pid.1)
  - ISO 18013-5 mDL (Mobile Driving Licence — org.iso.18013.5.1.mDL)
  - EUDI QEAA (Qualified Electronic Attestation of Attributes)

Handles age constraints (age_over_18, age_over_21, age_in_years), nationality/country filters,
document expiry, credential_sets for OR-based alternatives, and multi-credential queries.

Requires an Anthropic API key — configure via clavex_ai_configure.

Examples:
  "voglio accettare solo patenti italiane valide con età > 21"
  "verifica che l'utente sia maggiorenne (≥18) e cittadino EU"
  "accetta PID italiano, voglio nome, cognome e codice fiscale"
  "driving licence OR EU PID, minimum age 18, for a car rental"
  "accetta solo CIE italiane valide, nome, cognome, età ≥ 18"
  "verify the user has a valid Italian driving licence issued after 2020 with privilege category B"

Args:
  - org_id: Organization UUID (required — the AI key is stored per-org)
  - description: Natural language description of what to verify (Italian, English, or any language)
  - lang: Optional BCP-47 language for error/explanation messages (default: same as description)

Returns: { dcql_query: { credentials: [...], credential_sets?: [...] } } ready to use in an OID4VP request.
Use clavex_create_presentation_session or PATCH /oid4vci/configs/:config_id to attach it to a flow.`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        description: z.string().describe("Natural language description of what to verify, e.g. 'patente italiana valida con età > 21'"),
        lang:        z.string().optional().describe("Optional BCP-47 language code for explanation messages, e.g. it, en, fr"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, description, lang }) =>
      handleError(async () => {
        const result = await getClient().post<{
          dcql_query?: Record<string, unknown>;
          raw?: string;
          error?: string;
        }>(
          getClient().orgPath(org_id, "/ai/suggest-dcql"),
          { description, lang },
        );
        if (result.error || !result.dcql_query) {
          return `⚠️ Could not generate a valid DCQL query. Adjust the description and try again.\n\nRaw output:\n${result.raw ?? "(empty)"}`;
        }
        const dcql = result.dcql_query;
        const creds = (dcql.credentials as Array<Record<string, unknown>> ?? []);
        const summary = creds.map((c) => {
          const fmt = c.format as string ?? "?";
          const id = c.id as string ?? "?";
          const meta = c.meta as Record<string, unknown> ?? {};
          const type = (meta.vct_values as string[] ?? [meta.doctype_value as string]).filter(Boolean).join(", ") || "—";
          const claims = (c.claims as Array<Record<string, unknown>> ?? []).map((cl) => {
            const path = (cl.path as string[] ?? []).join(".");
            const vals = cl.values ? ` = ${JSON.stringify(cl.values)}` : "";
            return `\`${path}${vals}\``;
          });
          return `**${id}** (${fmt}, ${type})\n  Claims: ${claims.join(", ") || "—"}`;
        }).join("\n");
        return [
          "Generated DCQL query:",
          "",
          summary,
          "",
          "```json",
          JSON.stringify(dcql, null, 2),
          "```",
          "",
          "Use this as the `dcql_query` field in an OID4VP authorization request or via `PATCH /oid4vci/configs/:config_id` to attach it to a credential issuance flow.",
        ].join("\n");
      }),
  );
}

