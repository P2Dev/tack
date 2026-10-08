import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migrateDatabase, closeDatabase } from "@/lib/database";

vi.mock("server-only", () => ({}));

type Profile = { sub: string; email: string; email_verified: boolean; name: string };
let profile: Profile = { sub: "existing", email: "existing@example.com", email_verified: true, name: "Existing member" };
let server: Server, auth: typeof import("@/lib/auth").auth, admin: Pool, pool: Pool, issuer: string;
const base = "http://localhost:3198";
const codes = new Map<string, { challenge: string; profile: Profile }>();
const tokens = new Map<string, Profile>();
let tokenChecks = 0;
const oldEnv = { ...process.env };

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, issuer);
    const json = (data: unknown, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (url.pathname === "/.well-known/openid-configuration") return json({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", userinfo_endpoint: issuer + "/userinfo" });
    if (url.pathname === "/authorize") {
      const code = randomUUID(); codes.set(code, { challenge: url.searchParams.get("code_challenge")!, profile: { ...profile } });
      const callback = new URL(url.searchParams.get("redirect_uri")!); callback.searchParams.set("code", code); callback.searchParams.set("state", url.searchParams.get("state")!); callback.searchParams.set("iss", issuer);
      res.writeHead(302, { Location: callback.href }); return res.end();
    }
    if (url.pathname === "/token") {
      let body = ""; for await (const chunk of req) body += chunk;
      const params = new URLSearchParams(body); const saved = codes.get(params.get("code") || ""); codes.delete(params.get("code") || "");
      if (!saved || params.get("client_id") !== "tack-test" || params.get("client_secret") !== "test-secret" || createHash("sha256").update(params.get("code_verifier") || "").digest("base64url") !== saved.challenge) return json({ error: "invalid_grant" }, 400);
      tokenChecks++; const access = randomUUID(); tokens.set(access, saved.profile); return json({ access_token: access, token_type: "Bearer", expires_in: 3600 });
    }
    if (url.pathname === "/userinfo") { const user = tokens.get(req.headers.authorization?.replace("Bearer ", "") || ""); return json(user || { error: "unauthorized" }, user ? 200 : 401); }
    json({ error: "missing" }, 404);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const connectionString = process.env.TEST_DATABASE_URL || "postgresql://tack:tack@127.0.0.1:54329/tack";
  admin = new Pool({ connectionString }); await admin.query("DROP SCHEMA IF EXISTS tack_identity_test CASCADE; CREATE SCHEMA tack_identity_test");
  const url = new URL(connectionString); url.searchParams.set("options", "-c search_path=tack_identity_test");
  pool = new Pool({ connectionString: url.href }); await migrateDatabase(pool);
  process.env.DATABASE_URL = url.href; process.env.BETTER_AUTH_URL = base; process.env.BETTER_AUTH_TRUSTED_ORIGINS = base;
  process.env.BETTER_AUTH_SECRET = "identity-test-secret-longer-than-thirty-two";
  process.env.TACK_OIDC_ALLOW_LOCAL_HTTP = "true";
  process.env.TACK_OIDC_PROVIDERS = JSON.stringify([{ id: "corp", name: "Company", issuer, clientId: "tack-test", clientSecret: "test-secret", allowSignUp: false }, { id: "pool", name: "Pool", issuer, clientId: "tack-test", clientSecret: "test-secret", allowSignUp: true }]);
  delete process.env.COGNITO_ISSUER; delete process.env.COGNITO_CLIENT_ID; delete process.env.COGNITO_CLIENT_SECRET; delete process.env.TACK_BOOTSTRAP; delete process.env.TACK_AUTH_DEFAULT;
  await pool.query(`INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt",role,banned,initials,color) VALUES ('existing','Existing member','existing@example.com',TRUE,NOW(),NOW(),'user',FALSE,'EM','blue')`);
  await pool.query(`INSERT INTO account (id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES ('local','existing','credential','existing',$1,NOW(),NOW())`, [await hashPassword("local-password-123")]);
  auth = (await import("@/lib/auth")).auth;
});

afterAll(async () => {
  await closeDatabase(); if (pool) await pool.end();
  if (admin) { await admin.query("DROP SCHEMA IF EXISTS tack_identity_test CASCADE"); await admin.end(); }
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv);
});

function post(path: string, body: unknown) { return auth.handler(new Request(base + "/api/auth" + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) })); }
async function flow(provider = "corp", wrongState = false) {
  const start = await post("/sign-in/oauth2", { providerId: provider, callbackURL: "/?board=ENG&issue=ENG-1", errorCallbackURL: "/sign-in?providerError=1" });
  expect(start.status).toBe(200);
  const { url } = await start.json(); const authorization = new URL(url);
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorization.searchParams.get("scope")).toContain("openid");
  const cookie = start.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const redirect = await fetch(url, { redirect: "manual" }); const callback = new URL(redirect.headers.get("location")!);
  if (wrongState) callback.searchParams.set("state", "invalid-state");
  const response = await auth.handler(new Request(callback, { headers: { Cookie: cookie } }));
  return { response, callback, cookie };
}

describe("OIDC authorization-code integration", () => {
  it("keeps local sign-in available and public local signup disabled", async () => {
    expect((await post("/sign-in/email", { email: "existing@example.com", password: "local-password-123" })).status).toBe(200);
    expect((await post("/sign-up/email", { email: "outsider@example.com", password: "local-password-123", name: "Outsider", initials: "O", color: "blue" })).status).toBe(400);
  });
  it("uses PKCE and links a verified existing account while retaining its local password", async () => {
    const { response } = await flow();
    expect(response.status).toBe(302); expect(response.headers.get("location")).toContain("board=ENG&issue=ENG-1");
    const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const session = await auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });
    expect(session?.user.id).toBe("existing"); expect(session?.user.role).toBe("user");
    expect((await pool.query('SELECT "providerId" FROM account WHERE "userId" = $1', ["existing"])).rows.map(row => row.providerId).sort()).toEqual(["corp", "credential"]);
    expect(tokenChecks).toBeGreaterThan(0);
  });
  it("rejects invalid state and callback replay", async () => {
    const invalid = await flow("corp", true); expect(invalid.response.headers.get("location")).not.toContain("board=ENG");
    const valid = await flow(); const replay = await auth.handler(new Request(valid.callback, { headers: { Cookie: valid.cookie } }));
    expect(replay.headers.get("location")).not.toContain("board=ENG");
  });
  it("requires verified email and explicit new-member provisioning", async () => {
    profile = { sub: "unknown", email: "new@example.com", name: "New member", email_verified: false };
    expect((await flow("pool")).response.headers.get("location")).toContain("error=");
    profile.email_verified = true;
    expect((await flow("corp")).response.headers.get("location")).toContain("error=");
    expect((await pool.query('SELECT id FROM "user" WHERE email = $1', [profile.email])).rowCount).toBe(0);
    const created = (await flow("pool")).response;
    expect(created.headers.get("location")).toContain("board=ENG");
    expect((await pool.query('SELECT role, initials, color FROM "user" WHERE email = $1', [profile.email])).rows[0]).toMatchObject({ role: "user", initials: expect.any(String), color: "slate" });
  });
  it("lets a provider session manage hashed keys and enforces expiry, throttling and owner status", async () => {
    profile = { sub: "existing", email: "existing@example.com", name: "Existing member", email_verified: true };
    const { response } = await flow();
    const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const { keyManagementActor } = await import("@/lib/key-management");
    const { createAgentKey, listAgentKeys, authenticateAgent, changeAgentKey } = await import("@/lib/agent-keys");
    const actor = await keyManagementActor(new Request(base + "/api/keys", { method:"POST", headers:{Cookie:cookie, Origin:base} }));
    expect(actor.id).toBe("existing");
    const key = await createAgentKey(actor.id, {name:"Provider agent",scopes:["read"],boardIds:null,days:7});
    const stored = (await pool.query("SELECT key FROM apikey WHERE id=$1", [key.id])).rows[0];
    expect(stored.key === key.secret).toBe(false);
    expect(JSON.stringify(await listAgentKeys(actor.id)).includes(key.secret)).toBe(false);
    const request = new Request(base + "/api/v1/me", {headers:{Authorization:`Bearer ${key.secret}`}});
    expect((await authenticateAgent(request)).userId).toBe(actor.id);
    await pool.query('UPDATE apikey SET "rateLimitMax"=1,"requestCount"=1,"lastRequest"=NOW() WHERE id=$1', [key.id]);
    await expect(authenticateAgent(request)).rejects.toMatchObject({status:429});
    await pool.query('UPDATE apikey SET "rateLimitMax"=120,"requestCount"=0 WHERE id=$1', [key.id]);
    await pool.query('UPDATE "user" SET banned=TRUE WHERE id=$1', [actor.id]);
    await expect(authenticateAgent(request)).rejects.toMatchObject({status:401});
    await pool.query('UPDATE "user" SET banned=FALSE WHERE id=$1', [actor.id]);
    await changeAgentKey(actor,key.id,{name:"Renamed provider agent"});
    await pool.query(`UPDATE apikey SET "expiresAt"=NOW()-INTERVAL '1 second' WHERE id=$1`, [key.id]);
    await expect(authenticateAgent(request)).rejects.toMatchObject({status:401});
    expect((await listAgentKeys(actor.id)).some(item=>item.id===key.id)).toBe(true);
    await changeAgentKey(actor,key.id,{revoke:true});
  });
  it("blocks disabled accounts and rejects external return URLs", async () => {
    profile = { sub: "existing", email: "existing@example.com", name: "Existing member", email_verified: true };
    await pool.query('UPDATE "user" SET banned = TRUE WHERE id = $1', ["existing"]);
    expect((await flow()).response.headers.get("location")).toContain("error=");
    expect((await post("/sign-in/oauth2", { providerId: "corp", callbackURL: "https://evil.example" })).status).toBe(403);
  });
});
