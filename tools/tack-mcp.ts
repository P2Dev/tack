// Compatibility entry point. The installable package uses the same implementation.
import { main } from "../packages/tack-mcp/src/cli";
void main().catch(() => { console.error("Tack MCP could not start. Check configuration and runtime requirements."); process.exitCode = 1; });
