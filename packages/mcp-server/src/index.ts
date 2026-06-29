#!/usr/bin/env node
/**
 * Clavex MCP Server — entry point
 *
 * Exposes ~30 tools for managing Clavex via natural language through Claude.
 * Uses stdio transport (compatible with Claude Desktop, Claude API, MCP Inspector).
 *
 * Configuration via environment variables:
 *
 *   CLAVEX_BASE_URL   — required, e.g. https://auth.example.com
 *   CLAVEX_TOKEN      — pre-acquired JWT bearer token  (preferred)
 *
 *   — or —
 *
 *   CLAVEX_EMAIL      — admin email (auto-login on first call)
 *   CLAVEX_PASSWORD   — admin password
 *   CLAVEX_ORG_SLUG   — org slug (omit for superadmin login)
 *
 * Usage:
 *   node dist/index.js
 *   npx @clavex/mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerOrgTools }          from "./tools/orgs.js";
import { registerUserTools }         from "./tools/users.js";
import { registerGroupTools }        from "./tools/groups.js";
import { registerClientTools }       from "./tools/clients.js";
import { registerIDPTools }          from "./tools/idps.js";
import { registerPolicyTools }       from "./tools/policies.js";
import { registerCIBATools }         from "./tools/ciba.js";
import { registerFGATools }          from "./tools/fga.js";
import { registerAccessReviewTools } from "./tools/access_reviews.js";
import { registerSSFTools }          from "./tools/ssf.js";
import { registerAITools }           from "./tools/ai.js";
import { registerPAMTools }          from "./tools/pam.js";
import { registerDeveloperTools }    from "./tools/developer.js";

const server = new McpServer({
  name: "clavex-mcp-server",
  version: "1.2.0",
});

// Register all tool domains
registerOrgTools(server);
registerUserTools(server);
registerGroupTools(server);
registerClientTools(server);
registerIDPTools(server);
registerPolicyTools(server);
registerCIBATools(server);
registerFGATools(server);
registerAccessReviewTools(server);
registerSSFTools(server);
registerAITools(server);
registerPAMTools(server);
registerDeveloperTools(server);

// Connect via stdio (Claude Desktop / Claude API compatible)
const transport = new StdioServerTransport();
await server.connect(transport);
