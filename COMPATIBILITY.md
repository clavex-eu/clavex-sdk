# SDK compatibility and verification

The client SDKs and project generator retain Node 18 LTS support. The MCP server now requires Node 20 or newer. Full CI checks Node 20, 22 and 24, with a separate Node 18 job for packages that retain that support. No paid or live Clavex endpoint is required by these tests.

## React and UI

React remains an application-provided peer dependency. React DOM and test utilities are no longer installed as runtime dependencies of @clavex/react. Development dependencies provide the local test renderer. Packed-package consumer tests check React 17, 18 and 19: CommonJS and ESM imports, server rendering, a shared React instance, and public TypeScript declarations. They do not replace browser login or framework end-to-end tests.

The distributed bundles preserve a `use client` directive for Next.js. JSX compilation and declarations avoid assumptions about React 18-only JSX entry points/types.

## NextAuth

Use `ClavexProvider` with Auth.js / NextAuth v5:

```ts
import NextAuth from "next-auth";
import { ClavexProvider } from "@clavex/nextauth-provider";

NextAuth({ providers: [ClavexProvider({ issuer, clientId, clientSecret })] });
```

Use the explicit `ClavexProviderV4` factory with NextAuth v4:

```ts
import NextAuth from "next-auth";
import { ClavexProviderV4 } from "@clavex/nextauth-provider";

NextAuth({ providers: [ClavexProviderV4({ issuer, clientId, clientSecret })] });
```

V4 requires the `oauth` discriminator and explicit ID-token mode; v5 retains the `oidc` discriminator. PKCE, state and nonce checks remain enabled in both. The default factory's v5 behaviour is unchanged. The old v4 example using the default factory was incompatible with NextAuth v4. Packed consumer fixtures typecheck both factories against their intended NextAuth versions. No cast to any or suppressed consumer error is used.

## MCP and project generator

Zod 4 replaces Zod 3 in the MCP server. The HTTP adapter is updated to Hono 2 and the MCP package explicitly requires Node >=20; this is an intentional runtime requirement change for MCP only. An in-memory MCP client exercises tool discovery, input rejection and a valid dynamic-record request with stubbed HTTP. No live Clavex data or credentials are used. The MCP version now comes from its package manifest.

Inquirer 7 replaces Inquirer 5 while retaining Node 18 support. Generated Next.js App Router, Pages Router and Vite React source is typechecked against the SDKs. Hook names and callback usage match the public API. Framework major versions embedded by the generator (Next 14 and Vite 5) are intentionally unchanged in this compatibility maintenance update: these generated applications retain framework advisories and need a separate template/framework migration before production use. A clean audit of this workspace's production dependencies does not cover dependencies installed later by generated applications. Existing user applications are not modified.

## Publishing

The npm release workflow validates package name, exact manifest version and publishability before install/build, runs builds, typechecks and tests, and publishes only the selected workspace. All JavaScript tests are blocking; missing tests are not silently accepted for React/UI/core. Consumer compatibility tests run in CI. This branch does not change package versions or publish releases.
