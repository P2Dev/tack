import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { migrateDatabase } from "@/lib/database";
import { createIssueStore, type IssueStore } from "@/lib/issue-store";
import { ISSUE_STATUSES } from "@/lib/types";

const baseDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://tack:tack@127.0.0.1:54329/tack";
const schemaName = "tack_issue_store_test";
const adminPool = new Pool({ connectionString: baseDatabaseUrl });
const schemaDatabaseUrl = new URL(baseDatabaseUrl);
schemaDatabaseUrl.searchParams.set(
  "options",
  `-c search_path=${schemaName}`,
);
const database = new Pool({ connectionString: schemaDatabaseUrl.toString() });

describe("IssueStore", () => {
  let store: IssueStore;

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await migrateDatabase(database);
    store = createIssueStore(database);
  });

  beforeEach(async () => {
    await database.query(
      'TRUNCATE boards, issue_keys, issue_labels, issues, labels, account, session, verification, "user" CASCADE',
    );
    await database.query("INSERT INTO boards (id, name) VALUES ('TCK', 'Engineering board')");
    await database.query(
      "UPDATE app_meta SET value = '1' WHERE key = 'next_issue_number'",
    );
    await database.query(
      `INSERT INTO "user" (
         id, name, email, "emailVerified", "createdAt", "updatedAt",
         role, banned, initials, color
       ) VALUES (
         'member-alex', 'Alex Kim', 'alex@example.local', TRUE, NOW(), NOW(),
         'admin', FALSE, 'AK', 'rust'
       )`,
    );
  });

  afterAll(async () => {
    await database.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await adminPool.end();
  });

  it("numbers and orders boards independently, including archive and restore", async () => {
    await store.createBoard({ id: "ENG", name: "Engineering" });
    const a = await store.create({ title: "Original", status: "ready" });
    const b = await store.create({ title: "Other board", status: "ready", boardId: "ENG" });
    const c = await store.create({ title: "Other second", status: "ready", boardId: "ENG" });
    expect([a.key, b.key, c.key]).toEqual(["TCK-1", "ENG-1", "ENG-2"]);
    await store.move(c.id, { status: "ready", position: 0 }, "ENG");
    await store.archive(c.id, "ENG");
    await store.restore(c.id, "ENG");
    expect((await store.snapshot("TCK")).active.map(issue => [issue.key, issue.position])).toEqual([["TCK-1", 0]]);
    expect((await store.snapshot("ENG")).active.map(issue => [issue.key, issue.position])).toEqual([["ENG-2", 0], ["ENG-1", 1]]);
    await expect(store.snapshot("MISSING")).rejects.toThrow("no longer available");
  });

  it("transfers cards atomically, reserves keys, and makes retries safe", async () => {
    await store.createBoard({ id: "ENG", name: "Engineering" });
    const a = await store.create({ title: "Move me", status: "ready" });
    const b = await store.create({ title: "Stay here", status: "ready" });
    await store.update(a.id, { description: "Retain notes", assigneeId: "member-alex" });
    const moved = await store.transfer(a.id, { boardId: "ENG", fromBoardId: "TCK" });
    expect(moved).toMatchObject({ id: a.id, key: "ENG-1", previousKeys: ["TCK-1"], description: "Retain notes", assigneeId: "member-alex", position: 0 });
    expect((await store.get(b.id))?.position).toBe(0);
    expect((await store.getByKey("tck-1"))?.key).toBe("ENG-1");
    expect((await store.transfer(a.id, { boardId: "ENG", fromBoardId: "TCK" }))?.key).toBe("ENG-1");
    await expect(store.move(a.id, { status: "done", position: 0 }, "TCK")).rejects.toThrow("moved to another board");
    await expect(store.update(a.id, { title: "Stale edit" }, "TCK")).rejects.toThrow("moved to another board");
    await store.archive(a.id, "ENG");
    const returned = await store.transfer(a.id, { boardId: "TCK", fromBoardId: "ENG" });
    expect(returned).toMatchObject({ key: "TCK-3", archivedAt: expect.any(String) });
    expect(returned?.previousKeys.sort()).toEqual(["ENG-1", "TCK-1"]);
    expect((await store.getByKey("ENG-1"))?.id).toBe(a.id);
    await store.restore(a.id, "TCK");
    expect((await store.snapshot("ENG")).active).toHaveLength(0);
    expect((await store.snapshot("TCK")).active.map(issue => issue.position)).toEqual([0, 1]);
  });

  it("rejects nonempty and last-board removal and keeps removed IDs reserved", async () => {
    await expect(store.removeBoard("TCK")).rejects.toThrow("at least one");
    await store.createBoard({ id: "ENG", name: "Engineering" });
    const issue = await store.create({ title: "Archive still counts", status: "done", boardId: "ENG" });
    await store.archive(issue.id);
    await expect(store.removeBoard("ENG")).rejects.toThrow("active and archived");
    await store.transfer(issue.id, { boardId: "TCK", fromBoardId: "ENG" });
    await store.removeBoard("ENG");
    await expect(store.createBoard({ id: "ENG", name: "Reuse" })).rejects.toThrow("already been used");
    await expect(store.create({ title: "Gone board", status: "ready", boardId: "ENG" })).rejects.toThrow("no longer available");
    expect((await store.getByKey("ENG-1"))?.id).toBe(issue.id);
    expect(await store.getByKey("TCK-1extra")).toBeNull();
    expect(await store.getByKey("1")).toBeNull();
  });

  it("allocates unique board numbers for concurrent creation and transfers", async () => {
    await store.createBoard({ id: "ENG", name: "Engineering" });
    const originals = await Promise.all(Array.from({ length: 6 }, (_, index) => store.create({ title: `Card ${index}`, status: "ready" })));
    await Promise.all(originals.map(issue => store.transfer(issue.id, { boardId: "ENG", fromBoardId: "TCK" })));
    const cards = (await store.snapshot("ENG")).active;
    expect(cards.map(card => card.number).sort((a,b) => a-b)).toEqual([1,2,3,4,5,6]);
    expect(cards.map(card => card.position)).toEqual([0,1,2,3,4,5]);
    expect((await store.snapshot("TCK")).active).toEqual([]);
  });

  it("creates title-only issues with stable sequential keys", async () => {
    const first = await store.create({
      title: "Capture this",
      status: "backlog",
    });
    const second = await store.create({
      title: "And this",
      status: "backlog",
    });

    expect(first).toMatchObject({
      key: "TCK-1",
      title: "Capture this",
      description: "",
      status: "backlog",
      position: 0,
      archivedAt: null,
    });
    expect(second).toMatchObject({
      key: "TCK-2",
      position: 1,
    });
  });

  it("updates only editable details", async () => {
    const issue = await store.create({
      title: "Draft title",
      status: "ready",
    });
    const updated = await store.update(issue.id, {
      title: "Clear title",
      description: "A little more context.",
    });

    expect(updated).toMatchObject({
      id: issue.id,
      key: issue.key,
      title: "Clear title",
      description: "A little more context.",
      status: "ready",
      position: 0,
    });
  });

  it("keeps independent field patches from overwriting each other", async () => {
    const issue = await store.create({
      title: "Original title",
      status: "ready",
    });

    await store.update(issue.id, { title: "Title from session A" });
    await store.update(issue.id, { description: "Note from session B" });

    expect(await store.get(issue.id)).toMatchObject({
      title: "Title from session A",
      description: "Note from session B",
    });
  });

  it("assigns optional members and workspace labels", async () => {
    const issue = await store.create({
      title: "Add context",
      status: "backlog",
    });
    const member = (await store.listMembers())[0];
    const label = await store.createLabel({
      name: "Documentation",
      color: "violet",
    });

    const updated = await store.update(issue.id, {
      assigneeId: member.id,
      labelIds: [label.id],
    });

    expect(updated).toMatchObject({
      assigneeId: member.id,
      assignee: { id: member.id, displayName: member.displayName },
      labels: [{ id: label.id, name: "Documentation", color: "violet" }],
    });

    await store.update(issue.id, { assigneeId: null, labelIds: [] });
    expect(await store.get(issue.id)).toMatchObject({
      assigneeId: null,
      assignee: null,
      labels: [],
    });
  });

  it("removing a label clears its issue associations", async () => {
    const issue = await store.create({
      title: "Temporary context",
      status: "ready",
    });
    const label = await store.createLabel({
      name: "Temporary",
      color: "slate",
    });
    await store.update(issue.id, { labelIds: [label.id] });

    expect(await store.deleteLabel(label.id)).toBe(true);
    expect((await store.get(issue.id))?.labels).toEqual([]);
  });

  it("reorders issues transactionally within a column", async () => {
    const alpha = await store.create({ title: "Alpha", status: "backlog" });
    await store.create({ title: "Bravo", status: "backlog" });
    await store.create({ title: "Charlie", status: "backlog" });

    await store.move(alpha.id, { status: "backlog", position: 2 });

    expect(
      (await store.listActive())
        .filter((issue) => issue.status === "backlog")
        .map((issue) => [issue.title, issue.position]),
    ).toEqual([
      ["Bravo", 0],
      ["Charlie", 1],
      ["Alpha", 2],
    ]);
  });

  it("moves issues freely through all four statuses", async () => {
    const issue = await store.create({
      title: "Keep moving",
      status: "backlog",
    });

    for (const status of ISSUE_STATUSES.slice(1)) {
      const moved = await store.move(issue.id, { status, position: 0 });
      expect(moved).toMatchObject({ status, position: 0 });
    }

    const active = await store.listActive();
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe("done");
  });

  it("inserts into a target column and closes the previous gap", async () => {
    const first = await store.create({ title: "First", status: "backlog" });
    const second = await store.create({ title: "Second", status: "backlog" });
    const ready = await store.create({
      title: "Already ready",
      status: "ready",
    });

    await store.move(first.id, { status: "ready", position: 0 });

    const snapshot = await store.snapshot();
    expect(
      snapshot.active
        .filter((issue) => issue.status === "backlog")
        .map((issue) => [issue.id, issue.position]),
    ).toEqual([[second.id, 0]]);
    expect(
      snapshot.active
        .filter((issue) => issue.status === "ready")
        .map((issue) => [issue.id, issue.position]),
    ).toEqual([
      [first.id, 0],
      [ready.id, 1],
    ]);
  });

  it("archives and restores an issue near its previous position", async () => {
    await store.create({ title: "Alpha", status: "ready" });
    const bravo = await store.create({ title: "Bravo", status: "ready" });
    await store.create({ title: "Charlie", status: "ready" });

    const archived = await store.archive(bravo.id);
    expect(archived?.archivedAt).not.toBeNull();
    expect(
      (await store.listActive())
        .filter((issue) => issue.status === "ready")
        .map((issue) => [issue.title, issue.position]),
    ).toEqual([
      ["Alpha", 0],
      ["Charlie", 1],
    ]);

    const restored = await store.restore(bravo.id);
    expect(restored?.archivedAt).toBeNull();
    expect(
      (await store.listActive())
        .filter((issue) => issue.status === "ready")
        .map((issue) => [issue.title, issue.position]),
    ).toEqual([
      ["Alpha", 0],
      ["Bravo", 1],
      ["Charlie", 2],
    ]);
  });

  it("rejects blank titles and invalid positions", async () => {
    await expect(
      store.create({ title: "   ", status: "backlog" }),
    ).rejects.toThrow();

    const issue = await store.create({ title: "Valid", status: "backlog" });
    await expect(
      store.move(issue.id, { status: "ready", position: -1 }),
    ).rejects.toThrow();
  });
});
