#!/usr/bin/env node
/**
 * create-clavex-app — Scaffold a new app wired to Clavex identity in < 5 minutes.
 *
 * Flow:
 *   1. Prompt: app name + framework
 *   2. Prompt: Clavex URL + org slug + org ID + admin token
 *   3. Call POST /api/v1/organizations/:org_id/quick-register
 *   4. Scaffold project from embedded template
 *   5. Write .env.local with client credentials
 *   6. Print "npm install && npm run dev"
 */
import { input, select, password } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

type Framework = "nextjs-app" | "nextjs-pages" | "vite-react";

interface Credentials {
  clientId: string;
  clientSecret: string;
  issuer: string;
}

interface ProjectVars {
  appName: string;
  framework: Framework;
  creds: Credentials;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const NEXT_APP_LAYOUT = `import type { Metadata } from "next";
import { ClavexProvider } from "@clavex/react";
import "@clavex/ui/styles.css";

export const metadata: Metadata = { title: process.env.NEXT_PUBLIC_APP_NAME ?? "My App" };

// issuer and clientId are read from NEXT_PUBLIC_CLAVEX_URL / NEXT_PUBLIC_CLAVEX_CLIENT_ID
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClavexProvider>
          {children}
        </ClavexProvider>
      </body>
    </html>
  );
}
`;

const NEXT_APP_PAGE = `"use client";
import { useUser, useSignIn, useSignOut } from "@clavex/react";

export default function Home() {
  const { user, isSignedIn, isLoading } = useUser();
  const { signIn } = useSignIn();
  const { signOut } = useSignOut();

  if (isLoading) return <p>Loading…</p>;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Welcome to your Clavex app</h1>
      {isSignedIn ? (
        <>
          <p>Hello, {user?.name ?? user?.email}!</p>
          <button onClick={() => signOut()}>Sign out</button>
        </>
      ) : (
        <button onClick={() => signIn()}>Sign in with Clavex</button>
      )}
    </main>
  );
}
`;

const NEXT_APP_CALLBACK = `"use client";
import { useEffect } from "react";
import { useHandleRedirectCallback } from "@clavex/react";
import { useRouter } from "next/navigation";

export default function CallbackPage() {
  const { handleRedirectCallback } = useHandleRedirectCallback();
  const router = useRouter();

  useEffect(() => {
    handleRedirectCallback()
      .then((appState) => router.replace(appState?.returnTo ?? "/"))
      .catch(() => router.replace("/"));
  }, []);

  return <p>Completing sign in…</p>;
}
`;

const NEXT_PAGES_APP = `import type { AppProps } from "next/app";
import { ClavexProvider } from "@clavex/react";
import "@clavex/ui/styles.css";

// issuer and clientId are read from NEXT_PUBLIC_CLAVEX_URL / NEXT_PUBLIC_CLAVEX_CLIENT_ID
export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClavexProvider>
      <Component {...pageProps} />
    </ClavexProvider>
  );
}
`;

const NEXT_PAGES_INDEX = `import { useUser, useSignIn, useSignOut } from "@clavex/react";

export default function Home() {
  const { user, isSignedIn, isLoading } = useUser();
  const { signIn } = useSignIn();
  const { signOut } = useSignOut();

  if (isLoading) return <p>Loading…</p>;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Welcome to your Clavex app</h1>
      {isSignedIn ? (
        <>
          <p>Hello, {user?.name ?? user?.email}!</p>
          <button onClick={() => signOut()}>Sign out</button>
        </>
      ) : (
        <button onClick={() => signIn()}>Sign in with Clavex</button>
      )}
    </main>
  );
}
`;

const NEXT_PAGES_CALLBACK = `import { useEffect } from "react";
import { useHandleRedirectCallback } from "@clavex/react";
import { useRouter } from "next/router";

export default function CallbackPage() {
  const { handleRedirectCallback } = useHandleRedirectCallback();
  const router = useRouter();

  useEffect(() => {
    handleRedirectCallback()
      .then((appState) => router.replace(appState?.returnTo ?? "/"))
      .catch(() => router.replace("/"));
  }, []);

  return <p>Completing sign in…</p>;
}
`;

const VITE_MAIN = `import React from "react";
import ReactDOM from "react-dom/client";
import { ClavexProvider } from "@clavex/react";
import "@clavex/ui/styles.css";
import App from "./App.js";

// issuer and clientId are read from VITE_CLAVEX_URL / VITE_CLAVEX_CLIENT_ID
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClavexProvider>
      <App />
    </ClavexProvider>
  </React.StrictMode>,
);
`;

const VITE_APP = `import { useUser, useSignIn, useSignOut } from "@clavex/react";

export default function App() {
  const { user, isSignedIn, isLoading } = useUser();
  const { signIn } = useSignIn();
  const { signOut } = useSignOut();

  if (isLoading) return <p>Loading…</p>;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Welcome to your Clavex app</h1>
      {isSignedIn ? (
        <>
          <p>Hello, {user?.name ?? user?.email}!</p>
          <button onClick={() => signOut()}>Sign out</button>
        </>
      ) : (
        <button onClick={() => signIn()}>Sign in with Clavex</button>
      )}
    </main>
  );
}
`;

const VITE_CALLBACK = `import { useEffect } from "react";
import { useHandleRedirectCallback } from "@clavex/react";

export default function Callback() {
  const { handleRedirectCallback } = useHandleRedirectCallback();

  useEffect(() => {
    handleRedirectCallback()
      .then((appState) => {
        window.history.replaceState({}, "", "/");
        window.location.href = (appState as { returnTo?: string } | undefined)?.returnTo ?? "/";
      })
      .catch(() => { window.location.href = "/"; });
  }, []);

  return <p>Completing sign in…</p>;
}
`;

// ── Scaffolding ───────────────────────────────────────────────────────────────

function write(dir: string, rel: string, content: string): void {
  const abs = join(dir, rel);
  const parent = abs.substring(0, abs.lastIndexOf("/"));
  if (parent !== dir) mkdirSync(parent, { recursive: true });
  writeFileSync(abs, content, "utf8");
}

function scaffoldNextjsApp(dir: string, v: ProjectVars): void {
  const { appName } = v;
  const { clientId, issuer } = v.creds;

  write(dir, "app/layout.tsx", NEXT_APP_LAYOUT);
  write(dir, "app/page.tsx", NEXT_APP_PAGE);
  write(dir, "app/callback/page.tsx", NEXT_APP_CALLBACK);
  write(dir, ".env.local", envLocal("nextjs", issuer, clientId, v.creds.clientSecret));
  write(dir, "package.json", JSON.stringify({
    name: appName,
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      next: "^14.0.0",
      react: "^18.0.0",
      "react-dom": "^18.0.0",
      "@clavex/react": "latest",
      "@clavex/ui": "latest",
    },
    devDependencies: { typescript: "^5.0.0", "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18" },
  }, null, 2));
  write(dir, "tsconfig.json", JSON.stringify({
    compilerOptions: { target: "es5", lib: ["dom", "esnext"], allowJs: true, skipLibCheck: true, strict: true, jsx: "preserve", incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./*"] } },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  }, null, 2));
}

function scaffoldNextjsPages(dir: string, v: ProjectVars): void {
  const { appName } = v;
  const { clientId, issuer } = v.creds;

  write(dir, "pages/_app.tsx", NEXT_PAGES_APP);
  write(dir, "pages/index.tsx", NEXT_PAGES_INDEX);
  write(dir, "pages/callback.tsx", NEXT_PAGES_CALLBACK);
  write(dir, ".env.local", envLocal("nextjs", issuer, clientId, v.creds.clientSecret));
  write(dir, "package.json", JSON.stringify({
    name: appName,
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      next: "^14.0.0",
      react: "^18.0.0",
      "react-dom": "^18.0.0",
      "@clavex/react": "latest",
      "@clavex/ui": "latest",
    },
    devDependencies: { typescript: "^5.0.0", "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18" },
  }, null, 2));
}

function scaffoldViteReact(dir: string, v: ProjectVars): void {
  const { appName } = v;
  const { clientId, issuer } = v.creds;

  write(dir, "src/main.tsx", VITE_MAIN);
  write(dir, "src/App.tsx", VITE_APP);
  write(dir, "src/Callback.tsx", VITE_CALLBACK);
  write(dir, "index.html", `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);
  write(dir, "vite.config.ts", `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`);
  write(dir, ".env.local", envLocal("vite", issuer, clientId, v.creds.clientSecret));
  write(dir, "package.json", JSON.stringify({
    name: appName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
    dependencies: {
      react: "^18.0.0",
      "react-dom": "^18.0.0",
      "@clavex/react": "latest",
      "@clavex/ui": "latest",
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.0.0",
      typescript: "^5.0.0",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      vite: "^5.0.0",
    },
  }, null, 2));
  write(dir, "tsconfig.json", JSON.stringify({
    compilerOptions: { target: "ES2020", lib: ["ES2020", "DOM", "DOM.Iterable"], module: "ESNext", skipLibCheck: true, moduleResolution: "bundler", allowImportingTsExtensions: true, resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: "react-jsx", strict: true, noUnusedLocals: true, noUnusedParameters: true, noFallthroughCasesInSwitch: true },
    include: ["src"],
    references: [{ path: "./tsconfig.node.json" }],
  }, null, 2));
  write(dir, "tsconfig.node.json", JSON.stringify({
    compilerOptions: { composite: true, skipLibCheck: true, module: "ESNext", moduleResolution: "bundler", allowSyntheticDefaultImports: true },
    include: ["vite.config.ts"],
  }, null, 2));
}

function envLocal(type: "nextjs" | "vite", issuer: string, clientId: string, clientSecret: string): string {
  if (type === "nextjs") {
    return [
      `# Clavex — auto-generated by create-clavex-app`,
      `NEXT_PUBLIC_CLAVEX_URL=${issuer}`,
      `NEXT_PUBLIC_CLAVEX_CLIENT_ID=${clientId}`,
      `# Keep this secret — never expose to the browser`,
      `CLAVEX_CLIENT_SECRET=${clientSecret}`,
      "",
    ].join("\n");
  }
  return [
    `# Clavex — auto-generated by create-clavex-app`,
    `VITE_CLAVEX_URL=${issuer}`,
    `VITE_CLAVEX_CLIENT_ID=${clientId}`,
    `# Keep this secret — never expose to the browser`,
    `# CLAVEX_CLIENT_SECRET=${clientSecret}  # use only in server-side code`,
    "",
  ].join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log();
  console.log(chalk.bold.blue("  create-clavex-app") + chalk.dim("  — auth in 5 minutes"));
  console.log();

  // ── Step 1: Project info ──────────────────────────────────────────────────

  const appName = await input({
    message: "App name",
    default: "my-clavex-app",
    validate: (v) => (v.trim().length > 0 ? true : "App name is required"),
  });

  const framework = await select<Framework>({
    message: "Framework",
    choices: [
      { name: "Next.js 14  (App Router)", value: "nextjs-app" },
      { name: "Next.js 14  (Pages Router)", value: "nextjs-pages" },
      { name: "Vite + React", value: "vite-react" },
    ],
  });

  // ── Step 2: Clavex connection ─────────────────────────────────────────────

  console.log();
  console.log(chalk.dim("  Find these values in your Clavex admin dashboard → Settings → API.\n"));

  const clavexUrl = await input({
    message: "Clavex base URL",
    default: "https://id.example.com",
    validate: (v) => {
      try { new URL(v); return true; } catch { return "Enter a valid URL (e.g. https://id.example.com)"; }
    },
    transformer: (v) => v.replace(/\/$/, ""),
  });

  const orgId = await input({
    message: "Org ID (UUID)",
    validate: (v) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
        ? true
        : "Enter a valid UUID (e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6)",
  });

  console.log();
  console.log(chalk.dim("  Your admin API key is used once to register the OIDC client.\n  It will NOT be stored in the generated project.\n"));

  const adminToken = await password({
    message: "Admin API key or JWT",
    validate: (v) => (v.trim().length > 0 ? true : "Token is required"),
  });

  // ── Step 3: Register OIDC client ──────────────────────────────────────────

  const appUrl = "http://localhost:3000";
  const spinner = ora("Registering OIDC client with Clavex…").start();

  let creds: Credentials;

  try {
    const baseUrl = clavexUrl.replace(/\/$/, "");
    const res = await fetch(
      `${baseUrl}/api/v1/organizations/${orgId}/quick-register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken.trim()}`,
        },
        body: JSON.stringify({ app_url: appUrl, app_name: appName }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => String(res.status));
      spinner.fail(`Registration failed (HTTP ${res.status}): ${body}`);
      process.exit(1);
    }

    const data = (await res.json()) as {
      client_id: string;
      client_secret: string;
      issuer: string;
    };

    creds = { clientId: data.client_id, clientSecret: data.client_secret, issuer: data.issuer };
    spinner.succeed(`OIDC client registered  ${chalk.dim(`client_id=${creds.clientId}`)}`);
  } catch (err) {
    spinner.fail(`Network error: ${String(err)}`);
    process.exit(1);
  }

  // ── Step 4: Scaffold project ──────────────────────────────────────────────

  const dir = join(process.cwd(), appName);
  if (existsSync(dir)) {
    console.error(chalk.red(`\n  Directory "${appName}" already exists. Choose a different name or remove it first.`));
    process.exit(1);
  }

  const scaffoldSpinner = ora("Scaffolding project…").start();
  mkdirSync(dir, { recursive: true });

  const vars: ProjectVars = { appName, framework, creds };
  if (framework === "nextjs-app") scaffoldNextjsApp(dir, vars);
  else if (framework === "nextjs-pages") scaffoldNextjsPages(dir, vars);
  else scaffoldViteReact(dir, vars);

  scaffoldSpinner.succeed("Project scaffolded");

  // ── Step 5: Done ──────────────────────────────────────────────────────────

  console.log();
  console.log(chalk.bold.green("  Done!") + "  Your app is ready.\n");
  console.log(`  ${chalk.dim("$")} cd ${appName}`);
  console.log(`  ${chalk.dim("$")} npm install`);
  console.log(`  ${chalk.dim("$")} npm run dev`);
  console.log();
  console.log(chalk.dim(`  Registered redirect URIs:`));
  console.log(chalk.dim(`    ${appUrl}/callback`));
  console.log(chalk.dim(`    ${appUrl}/api/auth/callback`));
  console.log(chalk.dim(`    ${appUrl}/auth/callback`));
  console.log();
  console.log(chalk.yellow("  ⚠  The client secret is in .env.local — add .env.local to .gitignore!"));
  console.log();
}

main().catch((err: unknown) => {
  console.error(chalk.red("\n  Error:"), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
