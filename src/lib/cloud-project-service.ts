import type { Pool, PoolClient } from "pg";
import { AgentError, type AgentPrincipal } from "@/lib/agent-contract";
import { getDatabase, withTransaction } from "@/lib/database";
import { IssueStore } from "@/lib/issue-store";
import { importApprovalSchema, type ImportApproval, operatorMappingSchema, parseCloudProject, projectResponse } from "@/lib/cloud-project-contract";

function conflict(code: string, message: string): never { throw new AgentError(409, code, message); }
async function lockBoards(client: PoolClient) {
  // Share the existing board create/remove lock. Serializes UUID/code/slug races,
  // including absent rows; board and ledger updates commit or roll back together.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))");
}
export async function syncCloudProject(principal: AgentPrincipal, call: {
  id: string; body: unknown; idempotencyKey: string | null; requestId: string;
}, pool: Pool = getDatabase(), baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000") {
  return withTransaction(async client => {
    await lockBoards(client);
    // Revalidate every replay and hold lifecycle/owner rows until commit.
    const live = await client.query(`SELECT k.scopes,k.board_ids,u.role
      FROM agent_keys k JOIN "user" u ON u.id=k.user_id JOIN apikey a ON a.id=k.id
      WHERE k.id=$1 AND k.user_id=$2 AND a."referenceId"=k.user_id
      AND k.revoked_at IS NULL AND k.expires_at>clock_timestamp() AND NOT u.banned
      AND a.enabled AND a."expiresAt">clock_timestamp() FOR SHARE OF k,u,a`, [principal.keyId, principal.userId]);
    const actor = live.rows[0];
    if (!actor) throw new AgentError(401, "invalid_credentials", "This key or its owner is no longer active.");
    if (actor.role !== "admin" || actor.scopes.length !== 1 || actor.scopes[0] !== "projects:sync" || actor.board_ids !== null)
      throw new AgentError(403, "insufficient_scope", "An active administrator's dedicated projects:sync key is required.");
    const project = parseCloudProject(call.id, call.body, call.idempotencyKey);
    const stored = (await client.query("SELECT * FROM cloud_projects WHERE cloud_project_id=$1 FOR UPDATE", [project.cloudProjectId])).rows[0];
    // Reject pending explicit imports rather than accidentally provisioning over operator state.
    const operator = await client.query("SELECT 1 FROM app_meta WHERE key=$1", [`p2dev-cloud-project-${project.cloudProjectId}`]);
    if (!stored && operator.rowCount) conflict("mapping_import_required", "An operator must explicitly import this project's existing board mapping first.");
    const response = projectResponse(project, baseUrl);
    let replayed = false;
    if (stored) {
      if (stored.slug !== project.slug || stored.code !== project.code) conflict("immutable_identity", "Project slug and code cannot change.");
      if (project.revision < Number(stored.revision)) conflict("stale_revision", "This project has a newer revision.");
      const board = (await client.query("SELECT id,removed_at FROM boards WHERE id=$1 FOR UPDATE", [stored.code])).rows[0];
      if (!board || board.removed_at) conflict("board_unavailable", "The linked board requires operator recovery.");
      if (project.revision === Number(stored.revision) && stored.payload !== null) {
        // JSONB equality ignores key ordering and is independent of any expiring API cache.
        const same = await client.query("SELECT payload=$2::jsonb AS same FROM cloud_projects WHERE cloud_project_id=$1", [project.cloudProjectId, JSON.stringify(project)]);
        if (!same.rows[0].same) conflict("revision_conflict", "This revision already has a different projection.");
        replayed = true;
      }
    } else {
      const collision = await client.query("SELECT 1 FROM boards WHERE id=$1 UNION ALL SELECT 1 FROM cloud_projects WHERE slug=$2", [project.code, project.slug]);
      if (collision.rowCount) conflict("identity_collision", "This board code or project slug is already in use.");
      await new IssueStore(client, pool, true).createBoard({ id: project.code, name: project.name });
    }
    if (!replayed) {
      await client.query("UPDATE boards SET name=$2 WHERE id=$1", [project.code, project.name]);
      await client.query(`INSERT INTO cloud_projects(cloud_project_id,slug,code,revision,payload,response)
        VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) ON CONFLICT(cloud_project_id) DO UPDATE
        SET revision=EXCLUDED.revision,payload=EXCLUDED.payload,response=EXCLUDED.response,updated_at=NOW()`,
        [project.cloudProjectId, project.slug, project.code, project.revision, JSON.stringify(project), JSON.stringify(response)]);
    }
    await client.query("INSERT INTO agent_audit(request_id,user_id,key_id,operation,target,outcome) VALUES($1,$2,$3,'projects:sync',$4,$5)",
      [call.requestId, principal.userId, principal.keyId, project.cloudProjectId, replayed ? "replayed" : "applied"]);
    return { status: stored ? 200 : 201, data: response, replayed };
  }, pool);
}

// Local operator operation: an explicit manifest of UUIDs authorizes only the saved
// app_meta mappings. No fuzzy matching or automatic migration-time adoption.
export async function importCloudMappings(approvals: ImportApproval[], actorId: string, pool: Pool = getDatabase()) {
  const approved = approvals.map(value => importApprovalSchema.parse(value));
  const uuids = approved.map(value => value.cloudProjectId);
  if (!uuids.length || new Set(uuids).size !== uuids.length) throw new AgentError(400, "invalid_mapping", "Supply unique explicit project UUIDs.");
  return withTransaction(async client => {
    const actor = await client.query(`SELECT id FROM "user" WHERE id=$1 AND role='admin' AND NOT banned FOR SHARE`, [actorId]);
    if (!actor.rowCount) throw new AgentError(403, "forbidden", "An active Tack administrator must authorize the import.");
    await lockBoards(client);
    for (const expected of approved) {
      const id = expected.cloudProjectId;
      const entry = (await client.query("SELECT value FROM app_meta WHERE key=$1 FOR SHARE", [`p2dev-cloud-project-${id}`])).rows[0];
      if (!entry) conflict("mapping_missing", "The explicit operator mapping is missing.");
      let raw: unknown;
      try { raw = JSON.parse(entry.value); } catch { conflict("invalid_mapping", "The operator mapping is not valid JSON."); }
      const parsed = operatorMappingSchema.safeParse(raw);
      if (!parsed.success || parsed.data.cloudProjectId !== id) conflict("invalid_mapping", "The operator mapping identity is inconsistent.");
      const mapping = parsed.data;
      if (mapping.slug !== expected.slug || mapping.code !== expected.code || mapping.revision !== expected.revision)
        conflict("mapping_conflict", "The saved operator mapping does not match the approved manifest.");
      const board = (await client.query("SELECT id,removed_at FROM boards WHERE id=$1 FOR UPDATE", [mapping.boardId])).rows[0];
      if (!board || board.removed_at) conflict("board_unavailable", "The mapped board is unavailable.");
      const existing = (await client.query("SELECT * FROM cloud_projects WHERE cloud_project_id=$1", [id])).rows[0];
      if (existing) {
        if (existing.slug !== mapping.slug || existing.code !== mapping.code || Number(existing.revision) < mapping.revision)
          conflict("mapping_conflict", "The saved mapping conflicts with the integration ledger.");
        continue;
      }
      const collision = await client.query("SELECT 1 FROM cloud_projects WHERE code=$1 OR slug=$2", [mapping.code, mapping.slug]);
      if (collision.rowCount) conflict("mapping_conflict", "Another project owns this code or slug.");
      await client.query("INSERT INTO cloud_projects(cloud_project_id,slug,code,revision,imported) VALUES($1,$2,$3,$4,TRUE)", [id,mapping.slug,mapping.code,mapping.revision]);
      await client.query("INSERT INTO agent_audit(request_id,user_id,key_id,operation,target,outcome) VALUES('operator-import',$1,'operator','projects:import',$2,'imported')", [actorId,id]);
    }
    return { importedOrVerified: uuids.length };
  }, pool);
}
