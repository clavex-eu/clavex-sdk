import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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


export function createServer(): McpServer {
  const server = new McpServer({
    name: "clavex-mcp-server",
    version: JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
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

  return server;
}
