import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { scaffoldNextjsApp, scaffoldNextjsPages, scaffoldViteReact } from "../dist/index.js";

for (const [framework, scaffold] of [["nextjs-app", scaffoldNextjsApp], ["nextjs-pages", scaffoldNextjsPages], ["vite-react", scaffoldViteReact]]) {
  test(`generated ${framework} source matches the installed SDK contracts`, (t) => {
    const root = mkdtempSync(join(tmpdir(), "clavex-scaffold-"));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const app = join(root, "app"); mkdirSync(app);
    scaffold(app, {appName: "test-app", framework, creds: {issuer: "https://issuer.invalid/acme", clientId: "test", clientSecret: "test-only"}});
    symlinkSync(resolve("../../node_modules"), join(app, "node_modules"), "dir");
    const source = (dir) => readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
      const path = join(dir, entry.name);
      return entry.name === "node_modules" ? [] : entry.isDirectory() ? source(path) : entry.name.endsWith(".tsx") ? [path] : [];
    });
    try {
      execFileSync(resolve("../../node_modules/.bin/tsc"), ["--noEmit", "--strict", "--skipLibCheck", "--esModuleInterop", "--jsx", "react-jsx", "--module", "ESNext", "--moduleResolution", "bundler", "--target", "ES2020", ...source(app)], {cwd: app, stdio: "pipe"});
    } catch (error) {
      if (error.stdout) console.error(String(error.stdout));
      throw error;
    }
  });
}

test("CLI starts through an npm-style executable symlink without making registration requests", {timeout: 10000}, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "clavex-bin-"));
  const bin = join(root, "create-clavex-app");
  symlinkSync(resolve("dist/index.js"), bin);
  const child = spawn(process.execPath, [bin], {stdio: ["pipe", "pipe", "pipe"]});
  t.after(() => { child.kill(); rmSync(root, {recursive: true, force: true}); });
  const closed = once(child, "close");
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; if (output.includes("create-clavex-app")) child.kill(); });
  await closed;
  assert.match(output, /create-clavex-app/);
});
