# Dependency maintenance — 2026-11-02

Updated compatible JavaScript/TypeScript dependency ranges and refreshed the complete workspace lockfile. Public package versions, licenses, peer contracts and Node engine declarations are unchanged. NextAuth's development version is pinned to 5.0.0-beta.32 for its security fixes. The root Hono adapter override stays on 1.19.x to preserve Node 18 compatibility; a future Hono 2 migration requires a runtime decision.

Production builds and typechecks pass for every applicable workspace. Core SDK, NextAuth and webhook tests pass. Python webhook tests: 9 passed. UI's test command exits successfully but there are no UI tests. React's existing Jest/CommonJS transform rejects import.meta (TS1343); its tests cannot run until the ESM test setup is corrected. CI now tolerates only this React step, rather than ignoring all JavaScript test failures.

After the full compatible lockfile refresh, npm audit reports 0 critical, 2 high, 17 moderate and 8 low dependency findings. The high findings are Zod 3 and tmp through Inquirer 5; recommended upstream fixes require major upgrades, and Inquirer's newer runtime requirements need review. Other findings include inherited build/test tooling and the Hono 1 line. No forced major overrides were applied. A passing build is not a claim that all advisories are resolved.
