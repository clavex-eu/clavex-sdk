import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerAccessReviewTools(server: McpServer): void {
  // ── List access review campaigns ───────────────────────────────────────────
  server.registerTool(
    "clavex_list_access_reviews",
    {
      title: "List Access Review Campaigns",
      description: `List access review (access certification) campaigns for an organization.

Access reviews are periodic or triggered campaigns where managers certify whether
users should retain their roles and permissions (JML — Joiner/Mover/Leaver compliance).

Returns: id, name, status (pending/active/completed/cancelled), starts_at, ends_at, item counts.

Status values:
  "pending"   — scheduled, not yet started
  "active"    — in progress, items are awaiting reviewer decisions
  "completed" — all items decided
  "cancelled" — cancelled before completion

Use when:
  "show access review campaigns for org <id>"
  "what reviews are currently active?"
  "mostrami le campagne di access review"`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const campaigns = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/access-reviews"),
        );
        if (!Array.isArray(campaigns) || campaigns.length === 0) {
          return "_No access review campaigns found._";
        }
        return mdTable(campaigns, ["id", "name", "status", "starts_at", "ends_at"]);
      }),
  );

  // ── Create access review campaign ──────────────────────────────────────────
  server.registerTool(
    "clavex_create_access_review",
    {
      title: "Create Access Review Campaign",
      description: `Create a new access review (certification) campaign for an organization.

A campaign generates one review item per (user, role) assignment in the org.
Items are sent to reviewers who decide keep/revoke for each assignment.

Args:
  - org_id: Organization UUID
  - name: Campaign name — e.g. "Q2 2026 Quarterly Access Review" or "Annual HR Certification"
  - starts_at: ISO 8601 datetime when the campaign begins (e.g. "2026-06-01T00:00:00Z")
  - ends_at: ISO 8601 datetime when the campaign expires — unreviewed items auto-revoke
  - description (optional): Human-readable purpose of this campaign

Returns: Created campaign JSON including the campaign_id.

Use when:
  "create a quarterly access review for org <id> starting June 1"
  "lancia la campagna di access review trimestrale"
  "schedule annual certification"`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        name:        z.string().describe("Campaign name, e.g. 'Q2 2026 Quarterly Review'"),
        starts_at:   z.string().describe("ISO 8601 start datetime, e.g. '2026-06-01T00:00:00Z'"),
        ends_at:     z.string().describe("ISO 8601 end/deadline datetime"),
        description: z.string().optional().describe("Optional description of this review's scope"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, name, starts_at, ends_at, description }) =>
      handleError(async () => {
        const campaign = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/access-reviews"),
          { name, starts_at, ends_at, description },
        );
        return `Access review campaign created:\n\n${JSON.stringify(campaign, null, 2)}`;
      }),
  );

  // ── Launch access review campaign ─────────────────────────────────────────
  server.registerTool(
    "clavex_launch_review",
    {
      title: "Launch Access Review Campaign",
      description: `Immediately launch (activate) an access review campaign, generating review items and sending notifications to reviewers.

This moves the campaign from "pending" to "active" without waiting for the scheduled starts_at.
Use this to trigger an unscheduled or emergency review.

After launching:
  - One review item is created per (user, role) assignment in the org
  - Reviewer notification emails are sent
  - The worker processes items on a 15-minute tick

Args:
  - org_id: Organization UUID
  - campaign_id: UUID of the campaign to launch (use clavex_list_access_reviews to find it)

Returns: Launched campaign JSON.

Use when:
  "lancia la campagna di access review trimestrale"
  "launch access review <campaign_id> now"
  "activate the pending access certification"`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        campaign_id: z.string().uuid().describe("Campaign UUID to launch"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, campaign_id }) =>
      handleError(async () => {
        const campaign = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, `/access-reviews/${campaign_id}/launch`),
        );
        return `Campaign launched successfully:\n\n${JSON.stringify(campaign, null, 2)}`;
      }),
  );

  // ── Get campaign items ────────────────────────────────────────────────────
  server.registerTool(
    "clavex_get_review_items",
    {
      title: "Get Access Review Items",
      description: `Get all items (user-role pairs) in an access review campaign along with their status.

Each item represents one (user, role) assignment awaiting a keep/revoke decision.

Returns: user_id, user_email, role_id, role_name, reviewer_email, decision, decided_at.

Decision values:
  null      — not yet reviewed
  "keep"    — reviewer confirmed access should be retained
  "revoke"  — reviewer decided access should be removed (processed by the worker)

Use when:
  "show items for campaign <id>"
  "how many reviews are still pending?"
  "quali utenti sono in attesa di revisione?"`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        campaign_id: z.string().uuid().describe("Campaign UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, campaign_id }) =>
      handleError(async () => {
        const items = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, `/access-reviews/${campaign_id}/items`),
        );
        if (!Array.isArray(items) || items.length === 0) return "_No items found for this campaign._";
        return mdTable(items, ["id", "user_email", "role_name", "reviewer_email", "decision", "decided_at"]);
      }),
  );
}
