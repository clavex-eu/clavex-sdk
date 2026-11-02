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

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

await createServer().connect(new StdioServerTransport());
