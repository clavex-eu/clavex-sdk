# @clavex/nextauth-provider

Auth.js (NextAuth v5) and NextAuth v4 provider for [Clavex Identity Platform](https://clavex.eu).

Since Clavex is fully OIDC-compliant, the provider uses **OIDC discovery** — endpoint URLs are auto-configured from `<issuer>/.well-known/openid-configuration`. No hardcoded URLs needed.

## Installation

```bash
npm install @clavex/nextauth-provider next-auth
# or
pnpm add @clavex/nextauth-provider next-auth
```

## Quick start — Auth.js v5 (Next.js 13+ App Router)

**`auth.ts`**
```ts
import NextAuth from "next-auth";
import { ClavexProvider, clavexCallbacks } from "@clavex/nextauth-provider";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    ClavexProvider({
      issuer: "https://id.example.com/my-org",        // your Clavex org issuer
      clientId: process.env.CLAVEX_CLIENT_ID!,
      clientSecret: process.env.CLAVEX_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    ...clavexCallbacks,  // persists org_id, roles, groups, acr into session
  },
});
```

**`app/api/auth/[...nextauth]/route.ts`**
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**`middleware.ts`**
```ts
export { auth as middleware } from "@/auth";
```

## Quick start — NextAuth v4

**`pages/api/auth/[...nextauth].ts`**
```ts
import NextAuth from "next-auth";
import { ClavexProvider, clavexCallbacks } from "@clavex/nextauth-provider";

export default NextAuth({
  providers: [
    ClavexProvider({
      issuer: "https://id.example.com/my-org",
      clientId: process.env.CLAVEX_CLIENT_ID!,
      clientSecret: process.env.CLAVEX_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    ...clavexCallbacks,
  },
});
```

## Options

| Option          | Type                        | Default                          | Description                                       |
|-----------------|-----------------------------|----------------------------------|---------------------------------------------------|
| `issuer`        | `string`                    | **required**                     | Clavex org issuer URL (`https://<domain>/<slug>`) |
| `clientId`      | `string`                    | **required**                     | OAuth2 `client_id` registered in Clavex           |
| `clientSecret`  | `string`                    | **required**                     | OAuth2 `client_secret`                            |
| `scope`         | `string`                    | `"openid email profile"`         | Requested scopes                                  |
| `name`          | `string`                    | `"Clavex"`                       | Sign-in button label                              |
| `authorization` | `Record<string, string>`    | `{}`                             | Extra authorize params (e.g. `{ acr_values: "2" }`) |

## TypeScript: session type augmentation

Add to your `next-auth.d.ts` (or `auth.d.ts`):

```ts
import "@clavex/nextauth-provider";
```

This extends `Session.user` and the `JWT` type with Clavex fields:

```ts
session.user.orgId    // string | null — Clavex organisation ID
session.user.roles    // string[]      — roles assigned in Clavex
session.user.groups   // string[]      — groups the user belongs to
session.user.acr      // string | null — ACR value (if acr_values was requested)
```

## MFA / step-up authentication

Pass `acr_values` to require a specific authentication level:

```ts
ClavexProvider({
  issuer: "https://id.example.com/my-org",
  clientId: process.env.CLAVEX_CLIENT_ID!,
  clientSecret: process.env.CLAVEX_CLIENT_SECRET!,
  authorization: {
    acr_values: "2",   // require MFA (Clavex ACR level 2)
    prompt: "login",   // force re-authentication
  },
});
```

## Offline access (refresh tokens)

```ts
ClavexProvider({
  // ...
  scope: "openid email profile offline_access",
});
```

## Environment variables

```env
CLAVEX_CLIENT_ID=your-client-id
CLAVEX_CLIENT_SECRET=your-client-secret
AUTH_SECRET=<random 32-byte secret for NextAuth JWT encryption>
```

## How it works

1. User clicks "Sign in with Clavex"
2. NextAuth redirects to `<issuer>/authorize` with `response_type=code` + PKCE
3. User authenticates on Clavex (password, MFA, SSO, passkey…)
4. Clavex redirects back with `code`; NextAuth exchanges it for tokens via `<issuer>/token`
5. NextAuth fetches user profile from `<issuer>/userinfo`
6. `profile()` maps Clavex claims → Auth.js `User` object
7. `clavexCallbacks.jwt` persists `orgId`, `roles`, `groups`, `acr` into the encrypted JWT
8. `clavexCallbacks.session` exposes those fields in `useSession()` / `auth()`
