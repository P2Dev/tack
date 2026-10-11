import { build } from "esbuild";
import { isBuiltin } from "node:module";
import { cp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = resolve(root, "packages/tack-mcp");
await mkdir(resolve(pkg, "dist"), { recursive: true });
const result = await build({
  absWorkingDir: root, entryPoints: ["packages/tack-mcp/src/entry.ts"],
  outfile: "packages/tack-mcp/dist/tack-mcp.cjs", bundle: true,
  platform: "node", format: "cjs", target: "node24.9", metafile: true,
  banner: { js: "#!/usr/bin/env node" }, legalComments: "eof",
});
for (const output of Object.values(result.metafile.outputs))
  for (const dependency of output.imports)
    if (!isBuiltin(dependency.path)) throw new Error(`Unbundled runtime dependency: ${dependency.path}`);
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes("node_modules/")) continue;
  let folder = dirname(await realpath(resolve(root, input)));
  while (folder !== dirname(folder)) {
    try {
      const manifest = JSON.parse(await readFile(resolve(folder, "package.json"), "utf8"));
      if (manifest.name && manifest.version) { packages.set(`${manifest.name}@${manifest.version}`, { folder, manifest }); break; }
    } catch { /* Keep looking for the owning package. */ }
    folder = dirname(folder);
  }
}
const notices = [];
for (const [name, { folder, manifest }] of [...packages].sort()) {
  const licenses = (await readdir(folder)).filter(name => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(name));
  const text = (await Promise.all(licenses.map(name => readFile(resolve(folder, name), "utf8")))).join("\n\n");
  notices.push(`${name}\nDeclared license: ${typeof manifest.license === "string" ? manifest.license : JSON.stringify(manifest.license)}\n${text || "See package upstream for license terms."}`);
}
await writeFile(resolve(pkg, "THIRD_PARTY_NOTICES.txt"), notices.join("\n\n--------------------\n\n"));
await cp(resolve(root, "LICENSE"), resolve(pkg, "LICENSE"));
await rm(resolve(pkg, "skills"), { recursive: true, force: true });
await cp(resolve(root, "skills/tack"), resolve(pkg, "skills/tack"), { recursive: true, force: true });
console.log(`Built self-contained Tack MCP; ${packages.size} bundled dependency notices included.`);
