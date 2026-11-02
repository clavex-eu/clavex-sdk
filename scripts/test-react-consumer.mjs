import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const major = process.env.REACT_VERSION || "18";
if (!["17", "18", "19"].includes(major)) throw new Error("Unsupported test React version");
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), "clavex-react-consumer-"));
try {
  const tarballs = {};
  for (const name of ["react", "ui"]) {
    const packed = JSON.parse(execFileSync("npm", ["pack", "--workspace=@clavex/" + name, "--json", "--pack-destination", fixture], {encoding: "utf8"}));
    tarballs["@clavex/" + name] = "file:" + join(fixture, packed[0].filename);
  }
  writeFileSync(join(fixture, "package.json"), JSON.stringify({private: true, dependencies: {...tarballs, react: major, "react-dom": major, "@types/react": major, "@types/react-dom": major}}));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {cwd: fixture, stdio: "pipe"});
  writeFileSync(join(fixture, "consumer.cjs"), `
const assert = require("node:assert/strict");
const {createRequire} = require("node:module");
const {realpathSync} = require("node:fs");
const React = require("react");
const {renderToString} = require("react-dom/server");
const {ClavexProvider} = require("@clavex/react");
const {SignInButton} = require("@clavex/ui");
const html = renderToString(React.createElement(ClavexProvider, {issuer: "https://issuer.invalid/acme", clientId: "test"}, React.createElement(SignInButton, {disabled: true}, "Company login")));
assert.match(html, /Company login/);
assert.match(html, /disabled/);
for (const name of ["@clavex/react", "@clavex/ui"]) {
  const request = createRequire(require.resolve(name));
  assert.equal(realpathSync(request.resolve("react")), realpathSync(require.resolve("react")));
}
`);
  execFileSync(process.execPath, ["consumer.cjs"], {cwd: fixture, stdio: "pipe"});
  writeFileSync(join(fixture, "consumer.mjs"), `
import assert from "node:assert/strict";
import React from "react";
import {renderToString} from "react-dom/server.js";
import {ClavexProvider} from "@clavex/react";
import {SignInButton} from "@clavex/ui";
assert.match(renderToString(React.createElement(ClavexProvider, {issuer: "https://issuer.invalid/acme", clientId: "test"}, React.createElement(SignInButton, {disabled: true}, "Company login"))), /Company login/);
`);
  // The server subpath export varies between React 17 and later versions.
  if (major !== "17") {
    writeFileSync(join(fixture, "consumer.mjs"), readFileSync(join(fixture, "consumer.mjs"), "utf8").replace('"react-dom/server.js"', '"react-dom/server"'));
  }
  execFileSync(process.execPath, ["consumer.mjs"], {cwd: fixture, stdio: "pipe"});
  writeFileSync(join(fixture, "consumer.tsx"), `import * as React from "react"; import {ClavexProvider} from "@clavex/react"; import {SignInButton} from "@clavex/ui"; export const app = <ClavexProvider issuer="https://issuer.invalid/acme" clientId="test"><SignInButton disabled>Login</SignInButton></ClavexProvider>;`);
  execFileSync(resolve(root, "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--esModuleInterop", "--jsx", "react", "--module", "ESNext", "--moduleResolution", "bundler", "--target", "ES2020", "consumer.tsx"], {cwd: fixture, stdio: "pipe"});
  console.log(`React ${major}: packed CJS/ESM imports, rendering, shared React and public declarations passed`);
} catch (error) {
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  rmSync(fixture, {recursive: true, force: true});
}
