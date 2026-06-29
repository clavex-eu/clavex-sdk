# @clavex/mcp-server

MCP server for the [Clavex Identity Platform](https://clavex.eu), enabling Claude (and any MCP-compatible AI client) to manage organizations, users, OIDC clients, identity providers, and auth policies via natural language.

## Tools (~30 total)

| Domain | Tools |
|--------|-------|
| **Organizations** | `clavex_list_orgs`, `clavex_get_org`, `clavex_create_org`, `clavex_update_org` |
| **Users** | `clavex_list_users`, `clavex_get_user`, `clavex_create_user`, `clavex_update_user`, `clavex_delete_user`, `clavex_send_password_reset`, `clavex_list_user_roles` |
| **Groups & Roles** | `clavex_list_groups`, `clavex_create_group`, `clavex_list_group_members`, `clavex_add_group_member`, `clavex_remove_group_member`, `clavex_list_roles`, `clavex_assign_role`, `clavex_unassign_role` |
| **OIDC Clients** | `clavex_list_clients`, `clavex_get_client`, `clavex_create_client`, `clavex_update_client`, `clavex_rotate_client_secret` |
| **Identity Providers** | `clavex_list_idps`, `clavex_get_idp` |
| **Webhooks** | `clavex_list_webhooks`, `clavex_create_webhook`, `clavex_delete_webhook` |
| **Auth Policies** | `clavex_list_policies`, `clavex_create_policy`, `clavex_delete_policy`, `clavex_simulate_policy` |
| **API Keys** | `clavex_list_api_keys`, `clavex_create_api_key`, `clavex_delete_api_key` |
| **Usage** | `clavex_get_usage` |

## Setup

### 1. Build

```bash
cd sdk/mcp
npm install
npm run build
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "clavex": {
      "command": "node",
      "args": ["/path/to/clavex/sdk/mcp/dist/index.js"],
      "env": {
        "CLAVEX_BASE_URL": "https://auth.example.com",
        "CLAVEX_TOKEN": "your-admin-jwt-token"
      }
    }
  }
}
```

Or use email + password auto-login:

```json
{
  "mcpServers": {
    "clavex": {
      "command": "node",
      "args": ["/path/to/clavex/sdk/mcp/dist/index.js"],
      "env": {
        "CLAVEX_BASE_URL": "https://auth.example.com",
        "CLAVEX_EMAIL": "admin@example.com",
        "CLAVEX_PASSWORD": "your-password"
      }
    }
  }
}
```

### 3. Configure Claude API (claude.ai Projects)

In your project's MCP settings, point to this server with the same env variables.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAVEX_BASE_URL` | ✅ | Clavex server URL, e.g. `https://auth.example.com` |
| `CLAVEX_TOKEN` | One of these | Pre-acquired JWT bearer token |
| `CLAVEX_EMAIL` | One of these | Admin email for password-based login |
| `CLAVEX_PASSWORD` | with EMAIL | Admin password |
| `CLAVEX_ORG_SLUG` | optional | Org slug (omit for superadmin login) |

## Example Prompts

```
Create a new organization for Acme Corp with slug "acme" and domain acme.com

Register Grafana as an OIDC client in the acme org with redirect URI https://grafana.acme.com/login/generic_oauth

Add alice@acme.com to the acme org and put her in the Admins group

Block all logins from Russia and China for the acme organization

Show me all active users in org <id>

Simulate what would happen if a user from IP 1.2.3.4 (country: RU) tried to log into org <id>
```

## Testing

```bash
# Inspect available tools
npx @modelcontextprotocol/inspector node dist/index.js
```

## Security Notes

- **Never** commit `CLAVEX_TOKEN` or credentials to source control — use environment variables or secrets managers.
- The `clavex_delete_user`, `clavex_delete_webhook`, and `clavex_delete_api_key` tools are marked `destructiveHint: true` — Claude will prompt for confirmation before executing them.
- `client_secret` and API key secrets are returned only once at creation time and only over the MCP tool response (which is shown to you in the chat) — they are never logged.
