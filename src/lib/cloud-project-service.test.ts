import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/database";
import { IssueStore } from "@/lib/issue-store";
import { syncCloudProject, importCloudMappings } from "@/lib/cloud-project-service";
import { agentOperation } from "@/lib/agent-service";
import type { AgentPrincipal } from "@/lib/agent-contract";
const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://tack:tack@127.0.0.1:54329/tack");
const admin = new Pool({ connectionString: url.href });
const schema = "tack_cloud_sync_test";
url.searchParams.set("options", `-c search_path=${schema}`);
const pool = new Pool({ connectionString: url.href });
const actor: AgentPrincipal = { keyId: "cloud-key", userId: "cloud-admin", scopes: ["projects:sync"], boardIds: null };
const project = { schemaVersion: 1, cloudProjectId: "39cbda4f-bc0c-456a-b9dd-87a147fae3f1", revision: 1, slug: "example-project", code: "EXM", name: "Example", description: "Description", appUrl: "https://app.example", status: "active" };
const store = new IssueStore(pool, pool);
function sync(body = project) { return syncCloudProject(actor, { id: body.cloudProjectId, body, idempotencyKey: `cloud-project-${body.cloudProjectId}-r${body.revision}`, requestId: randomUUID() }, pool, "https://tack.example"); }
function approval(body = project) { return { cloudProjectId: body.cloudProjectId, slug: body.slug, code: body.code, revision: body.revision }; }
async function mapping(body = project) {
  await store.createBoard({ id: body.code, name: body.name });
  await pool.query("INSERT INTO app_meta(key,value) VALUES($1,$2)", [`p2dev-cloud-project-${body.cloudProjectId}`, JSON.stringify({ schemaVersion: 1, cloudProjectId: body.cloudProjectId, revision: body.revision, slug: body.slug, code: body.code, boardId: body.code, provisionedBy: "p2dev-cloud-operator" })]);
}
describe("Cloud project transactional integration", () => {
  beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrateDatabase(pool); await migrateDatabase(pool); });
  beforeEach(async () => {
    await pool.query('TRUNCATE boards,issues,agent_audit,"user" CASCADE');
    await pool.query("DELETE FROM app_meta WHERE key LIKE 'p2dev-cloud-project-%'");
    await pool.query("INSERT INTO boards(id,name) VALUES('TCK','Engineering')");
    await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt",role,banned,initials,color) VALUES('cloud-admin','Synthetic Admin','synthetic@example.test',TRUE,NOW(),NOW(),'admin',FALSE,'SA','blue')`);
    await pool.query(`INSERT INTO agent_keys(id,user_id,name,prefix,scopes,expires_at) VALUES('cloud-key','cloud-admin','Cloud','synthetic',ARRAY['projects:sync'],NOW()+INTERVAL '1 day')`);
    await pool.query(`INSERT INTO apikey(id,"referenceId",key,"expiresAt","createdAt","updatedAt") VALUES('cloud-key','cloud-admin','synthetic-hash',NOW()+INTERVAL '1 day',NOW(),NOW())`);
  });
  afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  it("creates once across concurrent retries and key rotation, then renames/archives/restores without altering cards", async () => {
    const original = await store.create({ title: "Existing engineering card", status: "ready", boardId: "TCK" });
    const results = await Promise.all(Array.from({ length: 5 }, () => sync()));
    expect(results.filter(result => result.status === 201)).toHaveLength(1);
    expect(results.map(result => result.data)).toEqual(Array(5).fill(results[0].data));
    const card = await store.create({ title: "Keep project history", status: "ready", boardId: "EXM" });
    const renamed = { ...project, name: "Renamed", revision: 2 }; await sync(renamed);
    await sync({ ...renamed, revision: 3, status: "archived" });
    expect(await store.get(card.id)).toEqual(card);
    await sync({ ...renamed, revision: 4, status: "active" });
    expect(await store.get(original.id)).toEqual(original);
    expect((await store.listBoards()).map(board => board.id).sort()).toEqual(["EXM", "TCK"]);
    expect((await pool.query("SELECT name FROM boards WHERE id='EXM'")).rows[0].name).toBe("Renamed");
    await pool.query("DELETE FROM agent_requests");
    expect((await sync({ ...renamed, revision: 4, status: "active" })).replayed).toBe(true);
    // Durable replay doesn't depend on key identity or transient request cache.
    await pool.query("UPDATE agent_keys SET id='rotated-key' WHERE id='cloud-key'");
    await pool.query("UPDATE apikey SET id='rotated-key' WHERE id='cloud-key'");
    const rotated = await syncCloudProject({ ...actor, keyId: "rotated-key" }, { id: project.cloudProjectId, body: { ...renamed, revision: 4, status: "active" }, idempotencyKey: `cloud-project-${project.cloudProjectId}-r4`, requestId: randomUUID() }, pool, "https://tack.example");
    expect(rotated.replayed).toBe(true);
    const audit = await pool.query("SELECT operation,target,outcome FROM agent_audit");
    expect(audit.rows.every(row => row.operation === "projects:sync" && row.target === project.cloudProjectId)).toBe(true);
  });
  it("rejects stale/conflicting revisions and immutable identity changes", async () => {
    await sync();
    await expect(sync({ ...project, name: "Conflict" })).rejects.toMatchObject({ status: 409, code: "revision_conflict" });
    await sync({ ...project, revision: 2 });
    await expect(sync()).rejects.toMatchObject({ status: 409, code: "stale_revision" });
    for (const change of [{ code: "NEW" }, { slug: "new-slug" }]) await expect(sync({ ...project, ...change, revision: 3 })).rejects.toMatchObject({ code: "immutable_identity" });
    expect((await pool.query("SELECT revision,payload FROM cloud_projects")).rows[0].payload.name).toBe("Example");
  });
  it("rejects unrelated code/slug ownership and permits separate equally named boards", async () => {
    await expect(sync({ ...project, code: "TCK" })).rejects.toMatchObject({ code: "identity_collision" });
    await sync();
    const next = { ...project, cloudProjectId: randomUUID(), code: "NEW" };
    await expect(sync(next)).rejects.toMatchObject({ code: "identity_collision" });
    await sync({ ...next, slug: "separate-project" });
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM cloud_projects")).rows[0].n).toBe(2);
  });
  it("serializes distinct UUIDs racing for one code and conflicting payloads racing for one revision", async () => {
    const races = await Promise.allSettled([sync(), sync({ ...project, cloudProjectId: randomUUID(), slug: "another" })]);
    expect(races.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM boards WHERE id='EXM'")).rows[0].n).toBe(1);
    const current = (await pool.query("SELECT payload FROM cloud_projects")).rows[0].payload;
    const revisionRace = await Promise.allSettled([sync({ ...current, revision: 2, name: "First" }), sync({ ...current, revision: 2, name: "Second" })]);
    expect(revisionRace.filter(result => result.status === "fulfilled")).toHaveLength(1);
  });
  it.each([
    ["ordinary key", "UPDATE agent_keys SET scopes=ARRAY['read','write']", 403],
    ["demoted owner", `UPDATE "user" SET role='user'`, 403],
    ["disabled owner", `UPDATE "user" SET banned=TRUE`, 401],
    ["expired scope record", "UPDATE agent_keys SET expires_at=NOW()-INTERVAL '1 day'", 401],
    ["revoked key", "UPDATE agent_keys SET revoked_at=NOW()", 401],
    ["disabled plugin key", "UPDATE apikey SET enabled=FALSE", 401],
    ["expired plugin key", `UPDATE apikey SET "expiresAt"=NOW()-INTERVAL '1 day'`, 401],
  ])("checks %s before a durable replay", async (_, sql, status) => {
    await sync(); await pool.query(sql as string);
    await expect(sync()).rejects.toMatchObject({ status });
    expect((await pool.query("SELECT revision FROM cloud_projects")).rows[0].revision).toBe("1");
  });
  it("denies card/board reads with a Cloud-only key", async () => {
    await expect(agentOperation(actor, { method: "GET", path: ["boards"], query: new URLSearchParams(), requestId: randomUUID() }, pool)).rejects.toMatchObject({ code: "insufficient_scope" });
  });
  it("imports only explicit LNG/MNJ operator mappings, leaves payload unknown until first authorized PUT", async () => {
    const lng = { ...project, cloudProjectId: "9ffc0bec-87e1-4d36-b1d8-01b5f19f21fd", code: "LNG", slug: "linguicity", name: "Linguicity" };
    const mnj = { ...project, cloudProjectId: "bb9cee42-3a47-4124-a821-df09b3b5a8f1", code: "MNJ", slug: "montjoy", name: "Montjoy" };
    await mapping(lng); await mapping(mnj);
    const card = await store.create({ title: "Keep imported card", status: "ready", boardId: "LNG" });
    await expect(sync(lng)).rejects.toMatchObject({ code: "mapping_import_required" });
    const ids = [approval(lng),approval(mnj)];
    await importCloudMappings(ids, actor.userId, pool); await importCloudMappings(ids, actor.userId, pool);
    expect((await pool.query("SELECT payload FROM cloud_projects")).rows.every(row => row.payload === null)).toBe(true);
    expect((await sync(lng)).status).toBe(200);
    expect((await sync(lng)).replayed).toBe(true);
    await sync({ ...mnj, revision: 2, name: "Updated" });
    expect(await store.get(card.id)).toEqual(card);
    expect((await store.listBoards()).map(board => board.id).sort()).toEqual(["LNG", "MNJ", "TCK"]);
  });
  it("rejects malformed or conflicting imports atomically and requires live admin", async () => {
    await mapping();
    const invalidId = randomUUID();
    await pool.query("INSERT INTO app_meta(key,value) VALUES($1,$2)", [`p2dev-cloud-project-${invalidId}`, JSON.stringify({ cloudProjectId: invalidId })]);
    await expect(importCloudMappings([approval(),{ ...approval(),cloudProjectId: invalidId }], actor.userId, pool)).rejects.toMatchObject({ code: "invalid_mapping" });
    expect((await pool.query("SELECT 1 FROM cloud_projects")).rowCount).toBe(0);
    await expect(importCloudMappings([{ ...approval(),code: "BAD" }], actor.userId, pool)).rejects.toMatchObject({ code: "mapping_conflict" });
    await pool.query(`UPDATE "user" SET role='user'`);
    await expect(importCloudMappings([approval()], actor.userId, pool)).rejects.toMatchObject({ status: 403 });
  });
  it("refuses first imported payload below provisioning revision and preserves the unknown payload", async () => {
    await mapping({ ...project, revision: 3 }); await importCloudMappings([approval({ ...project, revision: 3 })], actor.userId, pool);
    await expect(sync()).rejects.toMatchObject({ code: "stale_revision" });
    await expect(sync({ ...project, revision: 3, slug: "changed" })).rejects.toMatchObject({ code: "immutable_identity" });
    expect((await pool.query("SELECT payload FROM cloud_projects")).rows[0].payload).toBeNull();
    await sync({ ...project, revision: 3 });
  });
  it("rechecks expiry after waiting on the board lock", async () => {
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))");
    await pool.query("UPDATE agent_keys SET expires_at=clock_timestamp()+INTERVAL '150 milliseconds'");
    const pending = sync();
    const checked = expect(pending).rejects.toMatchObject({ status: 401 });
    await new Promise(resolve => setTimeout(resolve, 220));
    await blocker.query("COMMIT"); blocker.release();
    await checked;
    expect((await pool.query("SELECT 1 FROM cloud_projects")).rowCount).toBe(0);
  });
  it("supports an application rollback with the additive schema and preserved boards/cards/ledger", async () => {
    await sync();
    const saved = await store.create({ title: "Preserve on rollback", status: "done", boardId: "EXM" });
    await pool.query("UPDATE agent_keys SET revoked_at=NOW()");
    await pool.query("INSERT INTO agent_keys(id,user_id,name,prefix,scopes,expires_at) VALUES('ordinary','cloud-admin','Existing ordinary','synthetic',ARRAY['read','write'],NOW()+INTERVAL '1 day')");
    const ordinary: AgentPrincipal = { ...actor,keyId: "ordinary",scopes: ["read","write"] };
    // Existing agent/card service is unchanged and works with migration 004 retained.
    const result = await agentOperation(ordinary, { method: "GET",path: ["boards"],query: new URLSearchParams(),requestId: randomUUID() },pool);
    expect(result.status).toBe(200);
    await expect(sync()).rejects.toMatchObject({ status: 401 });
    expect(await store.get(saved.id)).toEqual(saved);
    expect((await pool.query("SELECT payload FROM cloud_projects")).rows[0].payload).toEqual(project);
    await store.create({ title: "After rollback", status: "ready", boardId: "TCK" });
  });
  it("rolls back board creation if ledger/audit commit fails", async () => {
    await pool.query(`CREATE FUNCTION fail_cloud_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$; CREATE TRIGGER fail_cloud_audit BEFORE INSERT ON agent_audit FOR EACH ROW EXECUTE FUNCTION fail_cloud_audit()`);
    try { await expect(sync()).rejects.toThrow(); expect((await pool.query("SELECT 1 FROM boards WHERE id='EXM'")).rowCount).toBe(0); expect((await pool.query("SELECT 1 FROM cloud_projects")).rowCount).toBe(0); }
    finally { await pool.query("DROP TRIGGER fail_cloud_audit ON agent_audit; DROP FUNCTION fail_cloud_audit()"); }
  });
});
