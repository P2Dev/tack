import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/database";
import { IssueStore } from "@/lib/issue-store";
import { agentOperation, type AgentCall } from "@/lib/agent-service";
import type { AgentPrincipal } from "@/lib/agent-contract";
const url = new URL(
  process.env.TEST_DATABASE_URL ??
    "postgresql://tack:tack@127.0.0.1:54329/tack",
);
const admin = new Pool({ connectionString: url.href });
const schema = "tack_agent_service_test";
url.searchParams.set("options", `-c search_path=${schema}`);
const pool = new Pool({ connectionString: url.href });
const actor: AgentPrincipal = {
  keyId: "test-key",
  userId: "test-user",
  scopes: ["read", "write", "archive", "transfer"],
  boardIds: null,
};
const store = new IssueStore(pool, pool);
function op(
  method: string,
  path: string[],
  body?: unknown,
  requestKey: string = randomUUID(),
) {
  return agentOperation(
    actor,
    {
      method,
      path,
      body,
      query: new URLSearchParams(),
      idempotencyKey: requestKey,
      requestId: randomUUID(),
    },
    pool,
  );
}
describe("Agent authorization, transactions and retries", () => {
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrateDatabase(pool);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE boards,issues,agent_audit,"user" CASCADE');
    await pool.query(
      `INSERT INTO boards(id,name) VALUES('TCK','Engineering'),('ENG','Other')`,
    );
    await pool.query(
      `INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt",role,banned,initials,color) VALUES('test-user','Agent owner','private@example.test',TRUE,NOW(),NOW(),'user',FALSE,'AO','rust')`,
    );
    await pool.query(
      `INSERT INTO agent_keys(id,user_id,name,prefix,scopes,expires_at) VALUES('test-key','test-user','Test','tack_prefix',ARRAY['read','write','archive','transfer'],NOW()+INTERVAL '1 day')`,
    );
  });
  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  it("serializes concurrent retries, rejects reuse with new input, and preserves revision safety", async () => {
    const body = { boardId: "TCK", title: "Create once", status: "ready" };
    const results = await Promise.all([
      op("POST", ["cards"], body, "create-once"),
      op("POST", ["cards"], body, "create-once"),
    ]);
    expect(results[0].data).toEqual(results[1].data);
    expect(
      (await pool.query("SELECT COUNT(*)::int AS count FROM issues")).rows[0]
        .count,
    ).toBe(1);
    await expect(
      op("POST", ["cards"], { ...body, title: "Different" }, "create-once"),
    ).rejects.toMatchObject({ status: 409, code: "idempotency_conflict" });
    const card = (await store.listActive("TCK"))[0];
    await store.update(card.id, { description: "Edited in browser" }, "TCK");
    await expect(
      op("PATCH", ["cards", card.id], {
        revision: card.revision,
        title: "Stale",
      }),
    ).rejects.toMatchObject({ status: 409, code: "revision_conflict" });
    const current = (await store.get(card.id))!;
    expect(current.revision).toBeGreaterThan(card.revision);
    const patched = await op("PATCH", ["cards", card.id], {
      revision: current.revision,
      title: "Fresh",
    });
    expect(patched.data).toMatchObject({ title: "Fresh" });
  });
  it("checks scope and board access for reads, writes, aliases and cached responses", async () => {
    const created = await op(
      "POST",
      ["cards"],
      { boardId: "TCK", title: "Scoped", status: "ready" },
      "scoped-create",
    );
    const card = (await store.listActive("TCK"))[0];
    await pool.query(
      "UPDATE agent_keys SET board_ids=ARRAY['TCK'],scopes=ARRAY['read']",
    );
    await expect(
      op("POST", ["cards"], {
        boardId: "TCK",
        title: "Denied",
        status: "ready",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      op("GET", ["boards", "ENG", "metadata"]),
    ).rejects.toMatchObject({ status: 404 });
    expect((await op("GET", ["boards"])).data).toMatchObject({
      boards: [{ id: "TCK" }],
    });
    await pool.query(
      "UPDATE agent_keys SET scopes=ARRAY['read','write','transfer']",
    );
    await expect(
      op("POST", ["cards", card.id, "transfer"], {
        revision: card.revision,
        fromBoardId: "TCK",
        boardId: "ENG",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await store.transfer(card.id, { fromBoardId: "TCK", boardId: "ENG" });
    await expect(op("GET", ["cards", card.key])).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      op(
        "POST",
        ["cards"],
        { boardId: "TCK", title: "Scoped", status: "ready" },
        "scoped-create",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await pool.query("UPDATE agent_keys SET board_ids=ARRAY['ENG']");
    expect((await op("GET", ["cards", card.key])).data).toMatchObject({
      key: "ENG-1",
      previousKeys: [],
    });
    expect(created.status).toBe(201);
  });
  it("fails closed immediately for revoked keys, expired keys, and disabled accounts", async () => {
    for (const sql of [
      "UPDATE agent_keys SET revoked_at=NOW()",
      "UPDATE agent_keys SET expires_at=NOW()-INTERVAL '1 second'",
      'UPDATE "user" SET banned=TRUE',
    ]) {
      await pool.query(sql);
      await expect(op("GET", ["me"])).rejects.toMatchObject({ status: 401 });
      await pool.query(
        "UPDATE agent_keys SET revoked_at=NULL,expires_at=NOW()+INTERVAL '1 day'",
      );
      await pool.query('UPDATE "user" SET banned=FALSE');
    }
  });
  it("supports assignment, transfer, archive/restore and bounded search without account email", async () => {
    let card = await store.create({
      title: "Lifecycle",
      status: "backlog",
      boardId: "TCK",
    });
    await op("PATCH", ["cards", card.id], {
      revision: card.revision,
      assigneeId: "test-user",
    });
    card = (await store.get(card.id))!;
    await op("POST", ["cards", card.id, "move"], {
      revision: card.revision,
      status: "done",
      position: 0,
    });
    card = (await store.get(card.id))!;
    await op("POST", ["cards", card.id, "transfer"], {
      revision: card.revision,
      fromBoardId: "TCK",
      boardId: "ENG",
    });
    card = (await store.get(card.id))!;
    await op("POST", ["cards", card.id, "archive"], {
      revision: card.revision,
    });
    card = (await store.get(card.id))!;
    expect(card.archivedAt).not.toBeNull();
    await op("POST", ["cards", card.id, "restore"], {
      revision: card.revision,
    });
    const call: AgentCall = {
      method: "GET",
      path: ["cards"],
      query: new URLSearchParams({ q: "TCK-1", limit: "1" }),
      requestId: randomUUID(),
    };
    const result = await agentOperation(actor, call, pool);
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(result.data).toMatchObject({
      cards: [{ key: "ENG-1", status: "done", archivedAt: null }],
    });
    const metadata = await op("GET", ["boards", "ENG", "metadata"]);
    expect(JSON.stringify(metadata)).not.toContain("email");
    expect(
      (await pool.query("SELECT COUNT(*)::int AS count FROM agent_audit"))
        .rows[0].count,
    ).toBe(5);
  });
});
