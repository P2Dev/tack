import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { it, expect } from "vitest";
import { migrateDatabase } from "@/lib/database";
import { createIssueStore } from "@/lib/issue-store";

it("migrates existing active and archived cards without renumbering or losing relationships", async () => {
  const connectionString = process.env.TEST_DATABASE_URL || "postgresql://tack:tack@127.0.0.1:54329/tack";
  const admin = new Pool({ connectionString });
  const url = new URL(connectionString); url.searchParams.set("options", "-c search_path=tack_board_migration_test");
  const pool = new Pool({ connectionString: url.href });
  try {
    await admin.query("DROP SCHEMA IF EXISTS tack_board_migration_test CASCADE; CREATE SCHEMA tack_board_migration_test");
    await pool.query(await readFile("migrations/postgres/001_initial.sql", "utf8"));
    await pool.query("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW()); INSERT INTO schema_migrations(name) VALUES ('001_initial.sql')");
    await pool.query("INSERT INTO issues(id,public_number,title,description,status,position,created_at,updated_at,archived_at) VALUES ('legacy-a',4,'Original','Keep note','ready',0,NOW(),NOW(),NULL), ('legacy-b',9,'Archived','Old note','done',0,NOW(),NOW(),NOW())");
    await pool.query("INSERT INTO issue_labels(issue_id,label_id) VALUES ('legacy-a','label-bug'); UPDATE app_meta SET value = '20' WHERE key = 'next_issue_number'");
    await migrateDatabase(pool); await migrateDatabase(pool);
    const store = createIssueStore(pool);
    expect(await store.getByKey("TCK-4")).toMatchObject({ id: "legacy-a", key: "TCK-4", description: "Keep note", labels: [{ id: "label-bug", name: "Bug", color: "rust" }] });
    expect(await store.getByKey("TCK-9")).toMatchObject({ id: "legacy-b", archivedAt: expect.any(String) });
    expect((await store.create({ title: "After migration", status: "ready" })).key).toBe("TCK-20");
  } finally { await pool.end(); await admin.query("DROP SCHEMA IF EXISTS tack_board_migration_test CASCADE"); await admin.end(); }
});
