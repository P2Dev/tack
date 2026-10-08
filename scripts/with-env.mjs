import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

// Explicit process environment wins over the local file (including in CI).
if (existsSync(".env")) process.loadEnvFile(".env");
for (const [target, source] of Object.entries({
  PGHOST: "POSTGRES_HOST",
  PGPORT: "POSTGRES_PORT",
  PGDATABASE: "POSTGRES_DB",
  PGUSER: "POSTGRES_USER",
  PGPASSWORD: "POSTGRES_PASSWORD",
})) {
  if (process.env[target] === undefined && process.env[source] !== undefined)
    process.env[target] = process.env[source];
}
if (!process.env.TEST_DATABASE_URL || !process.env.E2E_DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL || "postgresql://127.0.0.1");
  if (!process.env.DATABASE_URL) {
    url.hostname = process.env.PGHOST || "127.0.0.1";
    url.port = process.env.PGPORT || "54329";
    url.username = process.env.PGUSER || "tack";
    url.password = process.env.PGPASSWORD || "tack";
    url.pathname = "/" + (process.env.PGDATABASE || "tack");
  }
  process.env.TEST_DATABASE_URL ??= url.href;
  process.env.E2E_DATABASE_URL ??= url.href;
}
const [command, ...args] = process.argv.slice(2);
if (!command)
  throw new Error("Usage: node scripts/with-env.mjs <command> [arguments]");
const child = spawn(command, args, { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
