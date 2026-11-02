import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRelease } from "./resolve-npm-release.mjs";

test("release tags must select a publishable workspace at its exact version", (t) => {
  const root = mkdtempSync(join(tmpdir(), "clavex-release-test-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, "packages", "sdk"), {recursive: true});
  const manifest = join(root, "packages", "sdk", "package.json");
  writeFileSync(manifest, JSON.stringify({name: "@clavex/sdk", version: "1.2.3"}));
  assert.deepEqual(resolveRelease("@clavex/sdk@1.2.3", root), {name: "@clavex/sdk", version: "1.2.3", dir: "packages/sdk"});
  assert.throws(() => resolveRelease("@clavex/sdk@1.2.4", root), /differs/);
  assert.throws(() => resolveRelease("@clavex/unknown@1.2.3", root), /exactly one/);
  assert.throws(() => resolveRelease("@clavex/sdk@1.2.3';process.exit(0);//", root), /Expected/);
  writeFileSync(manifest, JSON.stringify({name: "@clavex/sdk", version: "1.2.3", private: true}));
  assert.throws(() => resolveRelease("@clavex/sdk@1.2.3", root), /private/);
});
