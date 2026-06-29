import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError, mdTable } from "../helpers.js";

export function registerGroupTools(server: McpServer): void {
  server.registerTool(
    "clavex_list_groups",
    {
      title: "List Groups",
      description: `List all groups in an organization.

Returns: id, name, description, member_count.

Use when: "show groups in org <id>", "what groups exist for acme?".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const groups = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/groups"),
        );
        return mdTable(groups, ["id", "name", "description"]);
      }),
  );

  server.registerTool(
    "clavex_create_group",
    {
      title: "Create Group",
      description: `Create a new group in an organization.

Args:
  - org_id: Organization UUID
  - name: Group name (e.g. "Admins", "Engineering")
  - description (optional): Group description

Returns: Created group JSON.

Use when: "create group Admins in org <id>", "add a new security group".`,
      inputSchema: {
        org_id:      z.string().uuid().describe("Organization UUID"),
        name:        z.string().describe("Group name"),
        description: z.string().optional().describe("Group description"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, name, description }) =>
      handleError(async () => {
        const group = await getClient().post<Record<string, unknown>>(
          getClient().orgPath(org_id, "/groups"),
          { name, description },
        );
        return `Group created:\n\n${JSON.stringify(group, null, 2)}`;
      }),
  );

  server.registerTool(
    "clavex_list_group_members",
    {
      title: "List Group Members",
      description: `List all users who are members of a group.

Returns: id, email, first_name, last_name of each member.

Use when: "who is in the Admins group?", "list members of group <id>".`,
      inputSchema: {
        org_id:   z.string().uuid().describe("Organization UUID"),
        group_id: z.string().uuid().describe("Group UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, group_id }) =>
      handleError(async () => {
        const members = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, `/groups/${group_id}/members`),
        );
        return mdTable(members, ["id", "email", "first_name", "last_name"]);
      }),
  );

  server.registerTool(
    "clavex_add_group_member",
    {
      title: "Add User to Group",
      description: `Add a user to a group.

Use when: "add Alice to the Admins group", "put user <user_id> in group <group_id>".`,
      inputSchema: {
        org_id:   z.string().uuid().describe("Organization UUID"),
        group_id: z.string().uuid().describe("Group UUID"),
        user_id:  z.string().uuid().describe("User UUID to add"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, group_id, user_id }) =>
      handleError(async () => {
        await getClient().put(
          getClient().orgPath(org_id, `/groups/${group_id}/members/${user_id}`),
        );
        return `User ${user_id} added to group ${group_id}.`;
      }),
  );

  server.registerTool(
    "clavex_remove_group_member",
    {
      title: "Remove User from Group",
      description: `Remove a user from a group.

Use when: "remove Alice from the Admins group", "revoke group membership for user <id>".`,
      inputSchema: {
        org_id:   z.string().uuid().describe("Organization UUID"),
        group_id: z.string().uuid().describe("Group UUID"),
        user_id:  z.string().uuid().describe("User UUID to remove"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, group_id, user_id }) =>
      handleError(async () => {
        await getClient().del(
          getClient().orgPath(org_id, `/groups/${group_id}/members/${user_id}`),
        );
        return `User ${user_id} removed from group ${group_id}.`;
      }),
  );

  // ── Roles ──────────────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_list_roles",
    {
      title: "List Roles",
      description: `List all roles defined in an organization.

Returns: id, name, description for each role.

Use when: "what roles are available in org <id>?", "list permissions/roles".`,
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id }) =>
      handleError(async () => {
        const roles = await getClient().get<Array<Record<string, unknown>>>(
          getClient().orgPath(org_id, "/roles"),
        );
        return mdTable(roles, ["id", "name", "description"]);
      }),
  );

  server.registerTool(
    "clavex_assign_role",
    {
      title: "Assign Role to User",
      description: `Assign a role to a user in an organization.

Use when: "give Alice the admin role", "assign role <id> to user <id>".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        role_id: z.string().uuid().describe("Role UUID"),
        user_id: z.string().uuid().describe("User UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, role_id, user_id }) =>
      handleError(async () => {
        await getClient().put(
          getClient().orgPath(org_id, `/roles/${role_id}/users/${user_id}`),
        );
        return `Role ${role_id} assigned to user ${user_id}.`;
      }),
  );

  server.registerTool(
    "clavex_unassign_role",
    {
      title: "Revoke Role from User",
      description: `Revoke a role from a user in an organization.

Use when: "remove admin role from Alice", "revoke role <id> from user <id>".`,
      inputSchema: {
        org_id:  z.string().uuid().describe("Organization UUID"),
        role_id: z.string().uuid().describe("Role UUID"),
        user_id: z.string().uuid().describe("User UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, role_id, user_id }) =>
      handleError(async () => {
        await getClient().del(
          getClient().orgPath(org_id, `/roles/${role_id}/users/${user_id}`),
        );
        return `Role ${role_id} revoked from user ${user_id}.`;
      }),
  );
}
