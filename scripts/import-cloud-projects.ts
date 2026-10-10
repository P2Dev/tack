import { readFile } from "node:fs/promises";
import { closeDatabase } from "../src/lib/database";
import { importApprovalSchema } from "../src/lib/cloud-project-contract";
import { importCloudMappings } from "../src/lib/cloud-project-service";
// Manifest contains only explicitly approved project identities, not user records or keys.
const [manifest, actorId] = process.argv.slice(2);
if (!manifest || !actorId || process.argv.length !== 4) throw new Error("Usage: node --import tsx scripts/import-cloud-projects.ts <approved-mappings.json> <admin-id>");
try {
  const approvals = importApprovalSchema.array().min(1).max(1000).parse(JSON.parse(await readFile(manifest, "utf8")));
  const result = await importCloudMappings(approvals, actorId);
  console.log(`Verified/imported ${result.importedOrVerified} explicit mappings.`);
} catch { console.error("Import failed; transaction rolled back. Check the approved manifest and saved mapping consistency."); process.exitCode = 1; }
finally { await closeDatabase(); }
