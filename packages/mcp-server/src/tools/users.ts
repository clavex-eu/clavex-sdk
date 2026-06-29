import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerUserTools(server: McpServer): void {
  // ── List users ─────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_users",
    {
      title: "List Users",
      description: `List all users in an organization.

Returns a table with: id, email, first_name, last_name, is_active, created_at.

Use when: "show users in org <id>", "list all accounts for acme", "who are the members?".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const users = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/users"),
        );
        return mdTable(users, ["id", "email", "first_name", "last_name", "is_active", "created_at"]);
      }),
  );

  // ── Get user ───────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_get_user",
    {
      title: "Get User",
      description: `Get detailed information about a specific user.

Returns full user JSON including roles, groups, and metadata.

Use when: "get user <id>", "show me alice's account details".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        user_id: z.string().uuid().describe("User UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, user_id }) =>
      handleError(async () => {
        const user = await getClient().get<Record<string, unknown>>(
          getClient().orgPath(org_id, `/users/${user_id}`),
        );
        return JSON.stringify(user, null, 2);
      }),
  );

  // ── Create user ────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_create_user",
    {
      title: "Create User",
      description: `Create a new user in an organization.

Args:
  - org_id: Organization UUID
  - email: User's email address (must be unique within the org)
  - first_name: Given name
  - last_name: Family name
  - password (optional): Initial password. If omitted, a welcome/reset email is sent.
  - send_welcome_email (optional): Send a welcome email (default true)

Returns: Created user JSON with the new user_id.

Use when: "add user alice@example.com to org <id>", "create account for John Doe".`,
      inputSchema: {
        org_id:              z.string().uuid().describe("Organization UUID"),
        email:               z.string().email().describe("User email address"),
        first_name:          z.string().describe("Given name"),
        last_name:           z.string().describe("Family name"),
        password:            z.string().optional().describe("Initial password (omit to trigger welcome email)"),
        send_welcome_email:  z.boolean().default(true).describe("Send welcome/activation email"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, email, first_name, last_name, password, send_welcome_email }) =>
      handleError(async () => {
        const user = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/users"),
          { email, first_name, last_name, password, send_welcome_email },
        );
        return `User created:\n\n${JSON.stringify(user, null, 2)}`;
      }),
  );

  // ── Update user ────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_update_user",
    {
      title: "Update User",
      description: `Update a user's profile or status (PATCH semantics — only provided fields change).

Args:
  - org_id, user_id: identifiers
  - first_name, last_name, email (optional): new values
  - is_active (optional): set to false to suspend the account
  - password (optional): force-set a new password

Returns: Updated user JSON.

Use when: "disable Alice's account", "change Bob's email", "rename user".`,
      inputSchema: {
        org_id:     z.string().uuid().describe("Organization UUID"),
        user_id:    z.string().uuid().describe("User UUID"),
        email:      z.string().email().optional().describe("New email address"),
        first_name: z.string().optional().describe("New given name"),
        last_name:  z.string().optional().describe("New family name"),
        is_active:  z.boolean().optional().describe("Set to false to suspend the account"),
        password:   z.string().optional().describe("Force-set a new password"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, user_id, ...updates }) =>
      handleError(async () => {
        const body = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined),
        );
        const user = await getClient().patch<Record<string, unknown>>(
          getClient().orgPath(org_id, `/users/${user_id}`),
          body,
        );
        return `User updated:\n\n${JSON.stringify(user, null, 2)}`;
      }),
  );

  // ── Delete user ────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_delete_user",
    {
      title: "Delete User",
      description: `Permanently delete a user from an organization. This action is irreversible.

Consider using clavex_update_user with is_active=false to suspend without deleting.

Use when: "delete user <id>", "remove Alice's account permanently".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        user_id: z.string().uuid().describe("User UUID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ org_id, user_id }) =>
      handleError(async () => {
        await getClient().del(getClient().orgPath(org_id, `/users/${user_id}`));
        return `User ${user_id} deleted from org ${org_id}.`;
      }),
  );

  // ── Password reset ─────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_send_password_reset",
    {
      title: "Send Password Reset Email",
      description: `Send a password reset email to a user.

Use when: "send password reset to alice", "user locked out — send reset email".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        user_id: z.string().uuid().describe("User UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, user_id }) =>
      handleError(async () => {
        await getClient().post(
          getClient().orgPath(org_id, `/users/${user_id}/send-password-reset`),
        );
        return `Password reset email sent to user ${user_id}.`;
      }),
  );

  // ── List user roles ────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_user_roles",
    {
      title: "List User Roles",
      description: `List all roles assigned to a specific user.

Use when: "what roles does Alice have?", "list permissions for user <id>".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        user_id: z.string().uuid().describe("User UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, user_id }) =>
      handleError(async () => {
        const roles = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, `/users/${user_id}/roles`),
        );
        return mdTable(roles, ["id", "name", "description"]);
      }),
  );
}
