import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const version = process.env.NEXTAUTH_VERSION || "5.0.0-beta.32";
if (!["4", "5.0.0-beta.32"].includes(version)) throw new Error("Unsupported NextAuth test version");
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), "clavex-nextauth-consumer-"));
try {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--workspace=@clavex/nextauth-provider", "--json", "--pack-destination", fixture], {encoding: "utf8"}));
  writeFileSync(join(fixture, "package.json"), JSON.stringify({private: true, dependencies: {"@clavex/nextauth-provider": "file:" + join(fixture, packed[0].filename), "next-auth": version, next: "^15.5.28", react: "18", "react-dom": "18", "@types/react": "18", "@types/node": "20"}}));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {cwd: fixture, stdio: "pipe"});
  const factory = version === "4" ? "ClavexProviderV4" : "ClavexProvider";
  writeFileSync(join(fixture, "consumer.ts"), `import NextAuth from "next-auth"; import {${factory}} from "@clavex/nextauth-provider"; NextAuth({providers: [${factory}({issuer: "https://issuer.invalid/acme", clientId: "example", clientSecret: "test-only"})]});`);
  execFileSync(resolve(root, "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--skipLibCheck", "--esModuleInterop", "--module", "ESNext", "--moduleResolution", "bundler", "--target", "ES2020", "consumer.ts"], {cwd: fixture, stdio: "pipe"});
  console.log(`NextAuth ${version}: packed provider declarations accepted by consumer`);
} catch (error) {
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  rmSync(fixture, {recursive: true, force: true});
}
