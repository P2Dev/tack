import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigurationError, loadConnection } from "./config";
import { createApiClient } from "./client";
import { createTackServer } from "./server";

export async function main(args = process.argv.slice(2)) {
  try {
    let envFile: string | undefined, installSkill: string | undefined;
    let check = false, help = false, version = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--env-file" || args[i] === "--install-skill") {
        const value = args[++i];
        if (!value || value.startsWith("--")) throw new ConfigurationError("Supply a path after --env-file or --install-skill.");
        if (args[i - 1] === "--env-file") envFile = value; else installSkill = value;
      } else if (args[i] === "--check") check = true;
      else if (args[i] === "--help") help = true;
      else if (args[i] === "--version") version = true;
      else throw new ConfigurationError("Unknown option. Use --help; credentials belong in the environment or an explicit file.");
    }
    if (help) { console.log("Tack MCP 1.1.0\nLaunch: tack-mcp [--env-file PRIVATE_FILE]\nRead-only diagnostics: tack-mcp [--env-file PRIVATE_FILE] --check\nInstall skill: tack-mcp --install-skill /path/to/skills/tack\nEnvironment: TACK_BASE_URL, TACK_API_KEY; explicit environment wins. No .env auto-loading. Node 24.9+."); return; }
    if (version) { console.log("1.1.0"); return; }
    if (installSkill) {
      if (envFile || check) throw new ConfigurationError("Install the skill separately from a connection check.");
      const destination = resolve(installSkill);
      if (existsSync(destination)) throw new ConfigurationError("Skill destination already exists. Review it before replacing or updating it.");
      const source = resolve(dirname(realpathSync(process.argv[1])), "../skills/tack");
      if (!existsSync(resolve(source, "SKILL.md"))) throw new ConfigurationError("The packaged skill is unavailable. Use the built package or repository skill source.");
      mkdirSync(dirname(destination), { recursive: true });
      mkdirSync(destination);
      try { cpSync(source, destination, { recursive: true, errorOnExist: true, force: false }); }
      catch { rmSync(destination, { recursive: true, force: true }); throw new ConfigurationError("The skill could not be installed. Check destination access."); }
      console.log("Installed Tack skill. Start a new Codex session to verify discovery."); return;
    }
    const connection = loadConnection(envFile);
    if (check) {
      const call = createApiClient(connection);
      const identity = await call("me");
      if (identity.isError) { console.error(JSON.stringify({ ok: false, ...identity.structuredContent })); process.exitCode = 1; return; }
      const boards = await call("boards");
      if (boards.isError) { console.error(JSON.stringify({ ok: false, ...boards.structuredContent })); process.exitCode = 1; return; }
      console.log(JSON.stringify({ ok: true, origin: connection.base.origin, scopes: identity.structuredContent.scopes, boardIds: identity.structuredContent.boardIds, boards: boards.structuredContent.boards })); return;
    }
    const server = createTackServer(connection);
    await server.connect(new StdioServerTransport());
  } catch (error) {
    console.error(error instanceof ConfigurationError ? error.message : "Tack MCP could not start. Check runtime and configuration.");
    process.exitCode = 1;
  }
}
