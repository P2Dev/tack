import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, "artifacts");
await mkdir(artifacts, { recursive: true });
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["pack", "--cache", resolve(artifacts, ".npm-cache"), "--ignore-scripts", "--pack-destination", artifacts], { cwd: resolve(root, "packages/tack-mcp"), stdio: "inherit", shell: process.platform === "win32" });
process.exitCode = result.status ?? 1;
