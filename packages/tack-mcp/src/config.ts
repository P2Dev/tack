import { readFileSync, statSync } from "node:fs";
import { parseEnv } from "node:util";
import type { Connection } from "./client";

export class ConfigurationError extends Error {}
export function loadConnection(envFile?: string, environment: Record<string, string | undefined> = process.env): Connection {
  let file: Record<string, string | undefined> = {};
  if (envFile) {
    try {
      const stat = statSync(envFile);
      if (!stat.isFile() || stat.size > 16384 || (process.platform !== "win32" && (stat.mode & 0o077)))
        throw new Error();
      file = parseEnv(readFileSync(envFile, "utf8"));
    } catch {
      throw new ConfigurationError("Cannot read the credential file. Use a regular private file (chmod 600 on Unix), smaller than 16 KB.");
    }
    if (Object.keys(file).some(name => !["TACK_BASE_URL", "TACK_API_KEY"].includes(name)))
      throw new ConfigurationError("The credential file may contain only TACK_BASE_URL and TACK_API_KEY. Supply CA trust through the Node startup environment.");
  }
  const key = environment.TACK_API_KEY ?? file.TACK_API_KEY;
  const address = environment.TACK_BASE_URL ?? file.TACK_BASE_URL;
  if (!key || !address || key.trim() !== key || /[\r\n]/.test(key))
    throw new ConfigurationError("Set TACK_BASE_URL and TACK_API_KEY in the environment or an explicit credential file.");
  let base: URL;
  try { base = new URL(address); } catch { throw new ConfigurationError("TACK_BASE_URL must be a valid HTTPS origin."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((base.protocol !== "https:" && !(base.protocol === "http:" && loopback)) || base.username || base.password || base.search || base.hash || base.pathname !== "/")
    throw new ConfigurationError("TACK_BASE_URL must be an HTTPS origin without credentials, path, query, or fragment. HTTP is allowed only on loopback.");
  if (base.protocol === "https:" && environment.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    throw new ConfigurationError("Certificate verification must stay enabled. Configure a trusted CA instead.");
  return { base, key };
}
