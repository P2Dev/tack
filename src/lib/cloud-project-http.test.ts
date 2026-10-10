import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDatabase, migrateDatabase } from "@/lib/database";
vi.mock("server-only", () => ({}));
const oldEnv = { ...process.env };
const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://tack:tack@127.0.0.1:54329/tack");
const admin = new Pool({ connectionString: url.href });
const schema = "tack_cloud_http_test";
url.searchParams.set("options", `-c search_path=${schema}`);
const pool = new Pool({ connectionString: url.href });
let keys: typeof import("@/lib/agent-keys");
let put: typeof import("@/app/api/v1/integrations/cloud/projects/[cloudProjectId]/route").PUT;
const project = { schemaVersion: 1, cloudProjectId: "39cbda4f-bc0c-456a-b9dd-87a147fae3f1", revision: 1, slug: "http-project", code: "HTP", name: "Synthetic HTTP", description: "", appUrl: null, status: "active" };
function request(secret?: string, body: unknown = project, extra: Record<string,string> = {}) {
  return new Request(`https://forged-host.example/api/v1/integrations/cloud/projects/${project.cloudProjectId}`, { method: "PUT", headers: {
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}), "Content-Type": "application/json", "Idempotency-Key": `cloud-project-${project.cloudProjectId}-r1`, ...extra,
  }, body: JSON.stringify(body) });
}
function call(secret?: string, body: unknown = project, extra: Record<string,string> = {}) { return put(request(secret,body,extra), { params: Promise.resolve({ cloudProjectId: project.cloudProjectId }) }); }
describe("Cloud bearer HTTP and provisioning lifecycle", () => {
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`); await migrateDatabase(pool);
    process.env.DATABASE_URL = url.href; process.env.BETTER_AUTH_URL = "https://tack.example";
    process.env.BETTER_AUTH_SECRET = "synthetic-http-secret-with-over-thirty-two-characters";
    delete process.env.TACK_OIDC_PROVIDERS; delete process.env.COGNITO_ISSUER; delete process.env.COGNITO_CLIENT_ID; delete process.env.COGNITO_CLIENT_SECRET;
    keys = await import("@/lib/agent-keys");
    put = (await import("@/app/api/v1/integrations/cloud/projects/[cloudProjectId]/route")).PUT;
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE boards,issues,agent_audit,"user" CASCADE');
    await pool.query("INSERT INTO boards(id,name) VALUES('TCK','Engineering')");
    await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt",role,banned,initials,color) VALUES
      ('admin','Synthetic Admin','admin@example.test',TRUE,NOW(),NOW(),'admin',FALSE,'SA','blue'),
      ('member','Synthetic Member','member@example.test',TRUE,NOW(),NOW(),'user',FALSE,'SM','blue')`);
  });
  afterAll(async () => {
    await closeDatabase(); await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env,oldEnv);
  });
  const integration = { name: "Synthetic Cloud", scopes: ["projects:sync"], boardIds: null, days: 7 };
  it("only active administrators provision exclusive integration keys; stores hashes, expiry and scope", async () => {
    await expect(keys.createAgentKey("member", integration)).rejects.toMatchObject({ status: 403 });
    await pool.query(`UPDATE "user" SET banned=TRUE WHERE id='admin'`);
    await expect(keys.createAgentKey("admin", integration)).rejects.toMatchObject({ status: 401 });
    await pool.query(`UPDATE "user" SET banned=FALSE WHERE id='admin'`);
    const key = await keys.createAgentKey("admin", integration);
    const stored = (await pool.query(`SELECT a.key,k.scopes,k.expires_at FROM apikey a JOIN agent_keys k ON k.id=a.id WHERE k.id=$1`, [key.id])).rows[0];
    expect(stored.key === key.secret).toBe(false); expect(stored.scopes).toEqual(["projects:sync"]);
    expect(stored.expires_at.getTime()-Date.now()).toBeGreaterThan(6*86400000);
    await expect(keys.createAgentKey("admin", { ...integration, scopes: ["read","projects:sync"] })).rejects.toThrow();
  });
  it("returns strict success from configured origin, replays after rotation and rejects old key after revocation", async () => {
    const old = await keys.createAgentKey("admin", integration);
    const first = await call(old.secret); expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const body = await first.json(); expect(body).toEqual({ schemaVersion: 1, cloudProjectId: project.cloudProjectId, revision: 1, resourceType: "board", resourceId: "HTP", url: "https://tack.example/?board=HTP" });
    const replay = await call(old.secret, Object.fromEntries(Object.entries(project).reverse()));
    expect(replay.status).toBe(200); expect(replay.headers.get("idempotency-replayed")).toBe("true"); expect(await replay.json()).toEqual(body);
    const fresh = await keys.createAgentKey("admin", integration);
    expect((await call(fresh.secret)).status).toBe(200);
    await keys.changeAgentKey({ id: "admin", role: "admin" }, old.id, { revoke: true });
    expect((await call(old.secret)).status).toBe(401);
    expect((await call(fresh.secret)).status).toBe(200);
  });
  it("rejects absent/ordinary credentials, invalid headers and unknown fields with structured errors", async () => {
    const missing = await call(); expect(missing.status).toBe(401); expect(missing.headers.get("www-authenticate")).toBe("Bearer");
    const ordinary = await keys.createAgentKey("admin", { ...integration, scopes: ["read","write"] });
    expect((await call(ordinary.secret)).status).toBe(403);
    const key = await keys.createAgentKey("admin", integration);
    expect((await call(key.secret,project,{ "Content-Type": "text/plain" })).status).toBe(415);
    expect((await call(key.secret,project,{ "Idempotency-Key": "wrong" })).status).toBe(400);
    const invalid = await call(key.secret,{ ...project,extra: true }); expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "invalid_input" }, requestId: expect.any(String) });
    expect((await pool.query("SELECT 1 FROM cloud_projects")).rowCount).toBe(0);
  });
  it.each([`UPDATE "user" SET banned=TRUE WHERE id='admin'`, `UPDATE "user" SET role='user' WHERE id='admin'`, `UPDATE apikey SET "expiresAt"=NOW()-INTERVAL '1 day'`, "UPDATE agent_keys SET expires_at=NOW()-INTERVAL '1 day'"])("denies a real bearer replay after lifecycle change", async sql => {
    const key = await keys.createAgentKey("admin", integration); await call(key.secret); await pool.query(sql);
    expect((await call(key.secret)).status).toBe(401);
  });
  it("returns Retry-After when plugin throttling denies a request", async () => {
    const key = await keys.createAgentKey("admin", integration);
    await pool.query(`UPDATE apikey SET "rateLimitMax"=1, "requestCount"=0 WHERE id=$1`, [key.id]);
    expect((await call(key.secret)).status).toBe(201);
    const limited = await call(key.secret); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toMatchObject({ error: { code: "rate_limited" } });
  });
});
