import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDatabase, migrateDatabase } from "@/lib/database";

vi.mock("aws-jwt-verify", () => ({ CognitoJwtVerifier: { create: () => ({ verify: async (token: string) => JSON.parse(token) }) } }));

let admin: Pool;
let pool: Pool;
let syncCloudUser: typeof import("@/lib/cloud-users").syncCloudUser;
const previous = { ...process.env };

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL || "postgresql://tack:tack@127.0.0.1:54329/tack";
  admin = new Pool({ connectionString });
  await admin.query("DROP SCHEMA IF EXISTS tack_cloud_users_test CASCADE; CREATE SCHEMA tack_cloud_users_test");
  const url = new URL(connectionString);
  url.searchParams.set("options", "-c search_path=tack_cloud_users_test");
  pool = new Pool({ connectionString: url.href });
  await migrateDatabase(pool);
  process.env.DATABASE_URL = url.href;
  process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test";
  process.env.COGNITO_CLIENT_ID = "test-client";
  process.env.TACK_COGNITO_MANAGED_USERS = "true";
  syncCloudUser = (await import("@/lib/cloud-users")).syncCloudUser;
});

afterAll(async () => {
  await closeDatabase();
  if (pool) await pool.end();
  if (admin) { await admin.query("DROP SCHEMA IF EXISTS tack_cloud_users_test CASCADE"); await admin.end(); }
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
});

const profile = { sub: "cloud-sub", email: "person@example.invalid", name: "Cloud User" };
const token = (sub: string, groups: string[]) => JSON.stringify({ sub, "cognito:groups": groups });

describe("managed Cloud users", () => {
  it("creates a Tack member and follows Cloud Admin promotions and demotions", async () => {
    await syncCloudUser(token(profile.sub, ["User"]), profile);
    expect((await pool.query('SELECT role FROM "user" WHERE email=$1', [profile.email])).rows[0].role).toBe("user");
    const id = (await pool.query('SELECT id FROM "user" WHERE email=$1', [profile.email])).rows[0].id;
    await pool.query('INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())', ["cloud-account", profile.sub, "cognito", id]);
    await syncCloudUser(token(profile.sub, ["Admin", "Developer"]), { ...profile, name: "Updated Name" });
    expect((await pool.query('SELECT role,name FROM "user" WHERE id=$1', [id])).rows[0]).toMatchObject({ role: "admin", name: "Updated Name" });
    await syncCloudUser(token(profile.sub, ["Developer"]), profile);
    expect((await pool.query('SELECT role FROM "user" WHERE id=$1', [id])).rows[0].role).toBe("user");
  });

  it("rejects mismatched subjects and email takeover", async () => {
    await expect(syncCloudUser(token("other-sub", ["Admin"]), profile)).rejects.toThrow(/subject/);
    await expect(syncCloudUser(token("other-sub", ["User"]), { ...profile, sub: "other-sub" })).rejects.toThrow(/different Cognito subject/);
  });
});
