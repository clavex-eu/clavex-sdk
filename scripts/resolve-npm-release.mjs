import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export function resolveRelease(tag, root = process.cwd()) {
  if (typeof tag !== "string" || !/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error("Expected a package@version release tag");
  }
  const separator = tag.lastIndexOf("@");
  const name = tag.slice(0, separator);
  const version = tag.slice(separator + 1);
  const matches = readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({ dir: `packages/${entry.name}`, manifest: JSON.parse(readFileSync(join(root, "packages", entry.name, "package.json"), "utf8")) }))
    .filter(entry => entry.manifest.name === name);
  if (matches.length !== 1) throw new Error(`Expected exactly one workspace named ${name}`);
  const { dir, manifest } = matches[0];
  if (!/^packages\/[a-zA-Z0-9_.-]+$/.test(dir)) throw new Error("Unsafe workspace directory");
  if (manifest.private) throw new Error("Cannot publish a private workspace");
  if (manifest.version !== version) throw new Error(`Tag version ${version} differs from package version ${manifest.version}`);
  return { name, version, dir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const release = resolveRelease(process.env.RELEASE_TAG);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `dir=${release.dir}\n`);
    console.log(JSON.stringify(release));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
