import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { handleError } from "../helpers.js";

// ── Well-known OIDC error codes and their plain-English explanations ───────────

const OIDC_ERRORS: Record<string, { cause: string; fix: string }> = {
  invalid_client: {
    cause: "The client_id or client_secret provided is wrong, or the client is not registered.",
    fix:   "Double-check CLAVEX_CLIENT_ID and CLAVEX_CLIENT_SECRET. In Clavex, go to Applications → your app → Credentials.",
  },
  invalid_grant: {
    cause: "The authorization code, refresh token, or device code is expired, already used, or was issued to a different client.",
    fix:   "Ensure you exchange the code only once. Refresh tokens are rotated — store the new one after each use. Codes expire in 5 minutes.",
  },
  unauthorized_client: {
    cause: "The client is not allowed to use the requested grant type.",
    fix:   "In Clavex, open the client registration and add the required grant type under 'Grant Types'.",
  },
  access_denied: {
    cause: "The user or the authorization server denied the request.",
    fix:   "This can also happen when the scope requested is not allowed for the client. Check allowed scopes in the client registration.",
  },
  unsupported_response_type: {
    cause: "The response_type in the authorization request is not supported.",
    fix:   "Use response_type=code (Authorization Code flow). implicit flow (token / id_token) is disabled by default.",
  },
  unsupported_grant_type: {
    cause: "The grant_type in the token request is not supported by this client.",
    fix:   "Add the required grant type to the client registration in Clavex.",
  },
  invalid_scope: {
    cause: "One or more scopes in the request are not registered or not allowed for this client.",
    fix:   "Add the required scopes to the client registration, or remove them from your request. Standard scopes: openid, profile, email, offline_access.",
  },
  invalid_request: {
    cause: "A required parameter is missing, duplicated, or otherwise malformed.",
    fix:   "Check all request parameters. Common issues: missing redirect_uri, duplicate parameters, malformed PKCE code_challenge.",
  },
  redirect_uri_mismatch: {
    cause: "The redirect_uri in the token request does not exactly match the one registered for this client.",
    fix:   "The URI must be byte-for-byte identical (scheme, host, path, trailing slash). Update the registered redirect_uri in Clavex if needed.",
  },
  login_required: {
    cause: "The authorization request had prompt=none but the user is not authenticated.",
    fix:   "Use prompt=none only for silent token renewal inside a hidden iframe. For first login, use prompt=login or omit prompt.",
  },
  consent_required: {
    cause: "The authorization request had prompt=none but user consent is required.",
    fix:   "Clavex requires explicit user consent for third-party clients. Remove prompt=none or handle the consent flow.",
  },
  interaction_required: {
    cause: "User interaction is required but prompt=none was specified.",
    fix:   "Remove prompt=none and allow the user to interact with the authorization page.",
  },
  server_error: {
    cause: "An unexpected internal error occurred in the authorization server.",
    fix:   "Check Clavex server logs. This is a server-side issue, not a client misconfiguration.",
  },
  temporarily_unavailable: {
    cause: "The server is temporarily overloaded or undergoing maintenance.",
    fix:   "Retry with exponential back-off. Check Clavex service health.",
  },
  expired_token: {
    cause: "The device code or token has expired.",
    fix:   "Device codes expire after 10 minutes. Restart the device authorization flow.",
  },
  authorization_pending: {
    cause: "The device code has been issued but the user has not yet approved the request.",
    fix:   "Keep polling the token endpoint at the specified interval. This is a normal state.",
  },
  slow_down: {
    cause: "The device is polling the token endpoint too frequently.",
    fix:   "Increase the polling interval by at least 5 seconds as required by RFC 8628 §3.5.",
  },
  pkce_required: {
    cause: "This client requires PKCE (Proof Key for Code Exchange) but none was provided.",
    fix:   "Generate a random code_verifier (43-128 chars), compute code_challenge = BASE64URL(SHA256(verifier)), and include both in the flow.",
  },
};

// ── Framework-specific integration snippets ────────────────────────────────────

function nextjsSnippet(p: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  orgSlug: string;
  redirectUri: string;
}): string {
  return `## Next.js Integration (App Router + next-auth v5)

### 1. Install dependencies
\`\`\`bash
npm install next-auth@beta @clavex/nextauth-provider
\`\`\`

### 2. Create \`auth.ts\` (project root)
\`\`\`ts
import NextAuth from "next-auth";
import Clavex from "@clavex/nextauth-provider";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Clavex({
      issuer:       "${p.baseUrl}/${p.orgSlug}",
      clientId:     "${p.clientId}",
      clientSecret: "${p.clientSecret}",
    }),
  ],
});
\`\`\`

### 3. Create \`app/api/auth/[...nextauth]/route.ts\`
\`\`\`ts
export { handlers as GET, handlers as POST } from "../../../../auth";
\`\`\`

### 4. Add environment variables (\`.env.local\`)
\`\`\`env
AUTH_SECRET=<run: openssl rand -hex 32>
AUTH_CLAVEX_ID=${p.clientId}
AUTH_CLAVEX_SECRET=${p.clientSecret}
CLAVEX_ISSUER=${p.baseUrl}/${p.orgSlug}
\`\`\`

### 5. Protect a route (\`middleware.ts\`)
\`\`\`ts
export { auth as middleware } from "./auth";
export const config = { matcher: ["/dashboard/:path*"] };
\`\`\`

### 6. Use in a Server Component
\`\`\`tsx
import { auth } from "@/auth";

export default async function Page() {
  const session = await auth();
  if (!session) return <p>Not signed in</p>;
  return <p>Hello, {session.user?.name}</p>;
}
\`\`\`

> **Redirect URI registered in Clavex:** \`${p.redirectUri}\`
> If your dev server runs on a different port, add that URI to the client too.`;
}

function reactSpaSnippet(p: {
  baseUrl: string;
  clientId: string;
  orgSlug: string;
  redirectUri: string;
}): string {
  return `## React SPA Integration (@clavex/react)

### 1. Install dependencies
\`\`\`bash
npm install @clavex/react
\`\`\`

### 2. Wrap your app (\`main.tsx\`)
\`\`\`tsx
import { ClavexProvider } from "@clavex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClavexProvider
      issuer="${p.baseUrl}/${p.orgSlug}"
      clientId="${p.clientId}"
      redirectUri="${p.redirectUri}"
      scopes={["openid", "profile", "email"]}
    >
      <App />
    </ClavexProvider>
  </StrictMode>
);
\`\`\`

### 3. Use the auth hook
\`\`\`tsx
import { useClavex } from "@clavex/react";

export function NavBar() {
  const { user, isLoading, signIn, signOut } = useClavex();
  if (isLoading) return <span>Loading…</span>;
  return user
    ? <button onClick={signOut}>Sign out ({user.email})</button>
    : <button onClick={signIn}>Sign in</button>;
}
\`\`\`

### 4. Add environment variables (\`.env\`)
\`\`\`env
VITE_CLAVEX_ISSUER=${p.baseUrl}/${p.orgSlug}
VITE_CLAVEX_CLIENT_ID=${p.clientId}
VITE_CLAVEX_REDIRECT_URI=${p.redirectUri}
\`\`\`

> **Registered redirect URI:** \`${p.redirectUri}\`  
> This is a **public client** (no secret). PKCE is enforced automatically.`;
}

function nodeExpressSnippet(p: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  orgSlug: string;
  redirectUri: string;
}): string {
  return `## Node.js / Express Integration (openid-client)

### 1. Install dependencies
\`\`\`bash
npm install openid-client express express-session
\`\`\`

### 2. Configure OIDC client (\`auth.mjs\`)
\`\`\`js
import { Issuer } from "openid-client";

const issuer = await Issuer.discover("${p.baseUrl}/${p.orgSlug}");

export const oidcClient = new issuer.Client({
  client_id:     "${p.clientId}",
  client_secret: "${p.clientSecret}",
  redirect_uris: ["${p.redirectUri}"],
  response_types: ["code"],
});
\`\`\`

### 3. Add login/callback routes (\`routes/auth.mjs\`)
\`\`\`js
import { generators } from "openid-client";
import { oidcClient } from "../auth.mjs";

router.get("/login", (req, res) => {
  const nonce = generators.nonce();
  req.session.nonce = nonce;
  res.redirect(oidcClient.authorizationUrl({
    scope: "openid profile email",
    nonce,
  }));
});

router.get("/callback", async (req, res) => {
  const params  = oidcClient.callbackParams(req);
  const tokens  = await oidcClient.callback("${p.redirectUri}", params, {
    nonce: req.session.nonce,
  });
  req.session.user = tokens.claims();
  res.redirect("/dashboard");
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect(oidcClient.endSessionUrl({ post_logout_redirect_uri: "http://localhost:3000" }));
});
\`\`\`

> **Redirect URI registered:** \`${p.redirectUri}\``;
}

function goSnippet(p: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  orgSlug: string;
  redirectUri: string;
}): string {
  return `## Go Integration (golang.org/x/oauth2 + coreos/go-oidc)

### 1. Install dependencies
\`\`\`bash
go get golang.org/x/oauth2 github.com/coreos/go-oidc/v3/oidc
\`\`\`

### 2. Configure provider (\`auth/oidc.go\`)
\`\`\`go
package auth

import (
    "context"
    "golang.org/x/oauth2"
    gooidc "github.com/coreos/go-oidc/v3/oidc"
)

const issuer = "${p.baseUrl}/${p.orgSlug}"

func NewProvider(ctx context.Context) (*gooidc.Provider, *oauth2.Config, error) {
    provider, err := gooidc.NewProvider(ctx, issuer)
    if err != nil {
        return nil, nil, err
    }
    cfg := &oauth2.Config{
        ClientID:     "${p.clientId}",
        ClientSecret: "${p.clientSecret}",
        RedirectURL:  "${p.redirectUri}",
        Endpoint:     provider.Endpoint(),
        Scopes:       []string{gooidc.ScopeOpenID, "profile", "email"},
    }
    return provider, cfg, nil
}
\`\`\`

> **Redirect URI registered:** \`${p.redirectUri}\``;
}

// ── Tool registration ──────────────────────────────────────────────────────────

export function registerDeveloperTools(server: McpServer): void {

  // ─── clavex_integrate_app ──────────────────────────────────────────────────
  server.registerTool(
    "clavex_integrate_app",
    {
      title: "Integrate App with Clavex Auth",
      description: `One-shot developer integration tool. Given a framework and a running app URL,
this tool:
  1. Creates (or reuses) an OIDC client registration in Clavex
  2. Returns copy-paste integration code for the specified framework

Supported frameworks: nextjs, react, express, go

Use when a developer says:
  "add auth to my Next.js app"
  "integrate Clavex into my React SPA at http://localhost:5173"
  "set up login for my Express server"
  "add Clavex authentication to my Go app"

Args:
  org_id     — Organization UUID to register the client in
  app_url    — The base URL of the app (e.g. http://localhost:3000). Used to
               auto-derive the redirect_uri and post_logout_redirect_uri.
  framework  — One of: nextjs | react | express | go
  app_name   — Human-readable name for the client registration (e.g. "My Dashboard")
  client_id  — (optional) Reuse an existing client_id instead of creating a new one`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        app_url:   z.string().url().describe("Base URL of the app, e.g. http://localhost:3000"),
        framework: z.enum(["nextjs", "react", "express", "go"]).describe("Target framework"),
        app_name:  z.string().min(1).describe("Human-readable app name"),
        client_id: z.string().optional().describe("Reuse existing client_id (skip registration)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ org_id, app_url, framework, app_name, client_id: existingClientId }) =>
      handleError(async () => {
        const api = getClient();
        const baseUrl = process.env.CLAVEX_BASE_URL!.replace(/\/+$/, "");

        // Derive redirect URI from app URL
        const appBase = app_url.replace(/\/+$/, "");
        const redirectUri = framework === "nextjs"
          ? `${appBase}/api/auth/callback/clavex`
          : `${appBase}/callback`;
        const postLogoutUri = appBase;

        // Look up the org to get its slug
        const org = await api.get<{ id: string; slug: string; name: string }>(
          `/api/v1/organizations/${org_id}`,
        );
        const orgSlug = org.slug;

        let clientId: string;
        let clientSecret: string | undefined;
        let isNew = false;

        if (existingClientId) {
          // Reuse existing — just add the redirect URI if missing
          const existing = await api.get<{ client_id: string; redirect_uris: string[] }>(
            api.orgPath(org_id, `/clients/${existingClientId}`),
          );
          clientId = existing.client_id;
          if (!existing.redirect_uris.includes(redirectUri)) {
            await api.patch(api.orgPath(org_id, `/clients/${existingClientId}`), {
              redirect_uris: [...existing.redirect_uris, redirectUri],
            });
          }
        } else {
          // Create a new client
          const isPublic = framework === "react";
          const grantTypes = isPublic
            ? ["authorization_code"]
            : ["authorization_code", "refresh_token"];

          const created = await api.post<{ client_id: string; client_secret?: string }>(
            api.orgPath(org_id, "/clients"),
            {
              name:                      app_name,
              redirect_uris:             [redirectUri],
              post_logout_redirect_uris: [postLogoutUri],
              grant_types:               grantTypes,
              response_types:            ["code"],
              scopes:                    ["openid", "profile", "email"],
              is_public:                 isPublic,
            },
          );
          clientId     = created.client_id;
          clientSecret = created.client_secret;
          isNew        = true;
        }

        const params = { baseUrl, clientId, clientSecret: clientSecret ?? "YOUR_CLIENT_SECRET", orgSlug, redirectUri };

        let snippet = "";
        switch (framework) {
          case "nextjs":  snippet = nextjsSnippet(params);  break;
          case "react":   snippet = reactSpaSnippet(params); break;
          case "express": snippet = nodeExpressSnippet(params); break;
          case "go":      snippet = goSnippet(params);       break;
        }

        const secretWarning = (isNew && clientSecret)
          ? `\n⚠️  **Save the client_secret now** — it will not be shown again:\n\`${clientSecret}\`\n`
          : "";

        return `## Clavex integration ready for **${app_name}** (${framework})
${secretWarning}
**client_id:** \`${clientId}\`
**org:** \`${orgSlug}\` (${org_id})
**redirect_uri registered:** \`${redirectUri}\`

---

${snippet}`;
      }),
  );

  // ─── clavex_explain_oidc_error ─────────────────────────────────────────────
  server.registerTool(
    "clavex_explain_oidc_error",
    {
      title: "Explain OIDC / OAuth2 Error",
      description: `Explain an OAuth2 / OIDC error code in plain English with a specific fix for Clavex.

Use when a developer sees an error like:
  "invalid_client", "invalid_grant", "redirect_uri_mismatch",
  "unauthorized_client", "invalid_scope", "slow_down", "pkce_required"
  or any OAuth2/OIDC error string.

Also handles Clavex-specific HTTP error bodies (pass the full JSON body as error_body).

Args:
  error_code  — The OAuth2 error code string (e.g. "invalid_grant")
  error_body  — (optional) Full JSON response body from the server for extra context`,
      inputSchema: {
        error_code: z.string().describe('OAuth2 error code, e.g. "invalid_grant"'),
        error_body: z.string().optional().describe("Full JSON error response body (optional)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ error_code, error_body }) =>
      handleError(async () => {
        const code = error_code.trim().toLowerCase();
        const known = OIDC_ERRORS[code];

        let bodyContext = "";
        if (error_body) {
          try {
            const parsed = JSON.parse(error_body) as Record<string, unknown>;
            if (parsed.error_description) {
              bodyContext = `\n**Server message:** ${parsed.error_description}`;
            }
          } catch {
            // ignore malformed JSON
          }
        }

        if (!known) {
          return `**Unknown error code: \`${error_code}\`**${bodyContext}

This error code is not in the standard OAuth2/OIDC specification. It may be:
- A Clavex-specific error — check the full response body and Clavex server logs
- A typo — common codes are: invalid_client, invalid_grant, redirect_uri_mismatch, invalid_scope

To dig deeper, enable debug logging in your Clavex instance and check the request that triggered this error.`;
        }

        return `## \`${error_code}\`${bodyContext}

**What it means:** ${known.cause}

**How to fix it in Clavex:** ${known.fix}

**Quick checklist:**
- Open the Clavex admin panel → your organization → Applications
- Find the affected client and verify its configuration matches your code
- Compare the exact redirect_uri, scopes, and grant_types in your request vs. what is registered`;
      }),
  );

  // ─── clavex_get_integration_config ────────────────────────────────────────
  server.registerTool(
    "clavex_get_integration_config",
    {
      title: "Get Integration Config for Existing Client",
      description: `Retrieve the OIDC configuration needed to integrate an existing Clavex client
into an application. Returns the issuer URL, endpoints, client_id, and recommended
environment variable names for common frameworks.

Use when a developer asks:
  "what are the OIDC settings for client <id>?"
  "give me the .env variables to connect my app to Clavex"
  "what's the discovery URL for my org?"

Args:
  org_id    — Organization UUID
  client_id — The OIDC client_id`,
      inputSchema: {
        org_id:    z.string().uuid().describe("Organization UUID"),
        client_id: z.string().describe("OIDC client_id"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ org_id, client_id }) =>
      handleError(async () => {
        const api = getClient();
        const baseUrl = process.env.CLAVEX_BASE_URL!.replace(/\/+$/, "");

        const [org, client] = await Promise.all([
          api.get<{ id: string; slug: string; name: string }>(`/api/v1/organizations/${org_id}`),
          api.get<{ client_id: string; name: string; redirect_uris: string[]; grant_types: string[]; is_public: boolean }>(
            api.orgPath(org_id, `/clients/${client_id}`),
          ),
        ]);

        const issuer   = `${baseUrl}/${org.slug}`;
        const discovery = `${issuer}/.well-known/openid-configuration`;

        return `## OIDC Integration Config — ${client.name}

**Issuer:** \`${issuer}\`
**Discovery URL:** ${discovery}
**client_id:** \`${client.client_id}\`
**Registered redirect URIs:** ${client.redirect_uris.map((u) => `\`${u}\``).join(", ")}
**Grant types:** ${client.grant_types.join(", ")}
**Public client (no secret):** ${client.is_public ? "Yes" : "No"}

---

### Environment variables

#### Next.js / next-auth
\`\`\`env
AUTH_CLAVEX_ID=${client.client_id}
AUTH_CLAVEX_SECRET=<your_client_secret>
CLAVEX_ISSUER=${issuer}
\`\`\`

#### React SPA (Vite)
\`\`\`env
VITE_CLAVEX_ISSUER=${issuer}
VITE_CLAVEX_CLIENT_ID=${client.client_id}
\`\`\`

#### Generic OIDC (openid-client / any)
\`\`\`env
OIDC_ISSUER=${issuer}
OIDC_CLIENT_ID=${client.client_id}
OIDC_CLIENT_SECRET=<your_client_secret>
OIDC_REDIRECT_URI=${client.redirect_uris[0] ?? "http://localhost:3000/callback"}
\`\`\`

#### Go (coreos/go-oidc)
\`\`\`env
CLAVEX_ISSUER=${issuer}
CLAVEX_CLIENT_ID=${client.client_id}
CLAVEX_CLIENT_SECRET=<your_client_secret>
CLAVEX_REDIRECT_URI=${client.redirect_uris[0] ?? "http://localhost:8080/callback"}
\`\`\``;
      }),
  );

  // ─── clavex_add_redirect_uri ───────────────────────────────────────────────
  server.registerTool(
    "clavex_add_redirect_uri",
    {
      title: "Add Redirect URI to Client",
      description: `Add one or more redirect URIs (or post-logout redirect URIs) to an existing
OIDC client without touching any other settings.

Use when a developer says:
  "add http://localhost:3001/callback to my client"
  "I changed my app port, update the redirect URI"
  "allow https://staging.example.com/api/auth/callback/clavex as a redirect"

Args:
  org_id                    — Organization UUID
  client_id                 — The OIDC client_id
  redirect_uris             — URIs to add (merged with existing ones)
  post_logout_redirect_uris — (optional) Post-logout URIs to add`,
      inputSchema: {
        org_id:                    z.string().uuid().describe("Organization UUID"),
        client_id:                 z.string().describe("OIDC client_id"),
        redirect_uris:             z.array(z.string().url()).min(1).describe("Redirect URIs to add"),
        post_logout_redirect_uris: z.array(z.string().url()).optional().describe("Post-logout URIs to add"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ org_id, client_id, redirect_uris, post_logout_redirect_uris }) =>
      handleError(async () => {
        const api = getClient();
        const existing = await api.get<{
          redirect_uris: string[];
          post_logout_redirect_uris?: string[];
        }>(api.orgPath(org_id, `/clients/${client_id}`));

        const merged    = [...new Set([...existing.redirect_uris, ...redirect_uris])];
        const mergedPLO = post_logout_redirect_uris
          ? [...new Set([...(existing.post_logout_redirect_uris ?? []), ...post_logout_redirect_uris])]
          : existing.post_logout_redirect_uris;

        const patch: Record<string, unknown> = { redirect_uris: merged };
        if (mergedPLO) patch.post_logout_redirect_uris = mergedPLO;

        await api.patch(api.orgPath(org_id, `/clients/${client_id}`), patch);

        const added = redirect_uris.filter((u) => !existing.redirect_uris.includes(u));
        return `Updated redirect URIs for client \`${client_id}\`.

**Added:** ${added.length ? added.map((u) => `\`${u}\``).join(", ") : "none (already registered)"}
**All redirect URIs now:** ${merged.map((u) => `\`${u}\``).join(", ")}`;
      }),
  );

  // ─── clavex_whoami ─────────────────────────────────────────────────────────
  server.registerTool(
    "clavex_whoami",
    {
      title: "Show Current Clavex Identity",
      description: `Show who the MCP server is authenticated as and which Clavex instance it is
connected to. Useful for orientation at the start of a session.

Use when a developer asks:
  "which Clavex am I connected to?"
  "what org am I in?"
  "show my MCP connection details"`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () =>
      handleError(async () => {
        const api = getClient();
        const baseUrl = process.env.CLAVEX_BASE_URL ?? "(not set)";
        try {
          const me = await api.get<{ email?: string; org_slug?: string; roles?: string[] }>("/api/v1/auth/me");
          return `**Clavex instance:** ${baseUrl}
**Authenticated as:** ${me.email ?? "unknown"}
**Org:** ${me.org_slug ?? "superadmin (no org)"}
**Roles:** ${me.roles?.join(", ") ?? "—"}`;
        } catch {
          return `**Clavex instance:** ${baseUrl}
Could not fetch identity — check CLAVEX_TOKEN or CLAVEX_EMAIL/CLAVEX_PASSWORD.`;
        }
      }),
  );
}
