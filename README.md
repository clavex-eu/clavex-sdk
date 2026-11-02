# Clavex SDKs

Official client SDKs and integrations for the [Clavex](https://clavex.eu)
identity platform. This is a monorepo: JavaScript/TypeScript packages live under
[`packages/`](packages/) (npm workspaces) and the Python package under
[`python/`](python/).

> The Go management SDK lives in its own repository:
> [clavex-eu/clavex-sdk-go](https://github.com/clavex-eu/clavex-sdk-go).
> The Terraform provider lives in
> [clavex-eu/terraform-provider-clavex](https://github.com/clavex-eu/terraform-provider-clavex).

## Packages

| Package | Registry | Description |
|---|---|---|
| [`@clavex/sdk`](packages/sdk) | npm | TypeScript/Node.js management SDK. |
| [`@clavex/react`](packages/react) | npm | React hooks & context for auth flows. |
| [`@clavex/ui`](packages/ui) | npm | Pre-built React UI components (requires `@clavex/react`). |
| [`@clavex/mcp-server`](packages/mcp-server) | npm | MCP server exposing Clavex tools to AI agents. |
| [`@clavex/nextauth-provider`](packages/nextauth-provider) | npm | Auth.js / NextAuth provider. |
| [`@clavex/webhooks`](packages/webhooks) | npm | Webhook signature verification (JS). |
| [`create-clavex-app`](packages/create-clavex-app) | npm | Project scaffolder. |
| [`clavex-webhooks`](python/clavex-webhooks) | PyPI | Webhook signature verification (Python). |

## Development

```bash
npm install          # installs all workspaces
npm run build        # builds every package
npm test             # runs package test suites
```

Python package:

```bash
cd python/clavex-webhooks
python -m build      # produces wheel + sdist
pytest               # runs tests
```

### Known issues

- `@clavex/react`'s Jest suite needs a full ESM/React-interop test setup (the
  source uses `import.meta.env`). Build and type emission are unaffected;
  tracked separately.

## Releasing

- **npm**: bump the target package version and push a tag `<pkg>@x.y.z`; the
  `release-npm` workflow publishes it (requires the `NPM_TOKEN` secret).
- **PyPI**: push a tag `py-x.y.z`; the `release-pypi` workflow publishes via
  PyPI Trusted Publishing (OIDC, no token).

## License

Apache License 2.0 — see [LICENSE](LICENSE).

See [COMPATIBILITY.md](COMPATIBILITY.md) for tested React/NextAuth versions, the v4 provider factory, publishing checks and generator template limitations.
