import { Pool } from "pg";

import {
  closeDatabase,
  getDatabase,
  migrateDatabase,
} from "../src/lib/database";

const baseDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://tack:tack@127.0.0.1:54329/tack";
const schemaName = "tack_playwright";
const adminPool = new Pool({ connectionString: baseDatabaseUrl });

await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
await adminPool.query(`CREATE SCHEMA ${schemaName}`);
await adminPool.end();

const schemaDatabaseUrl = new URL(baseDatabaseUrl);
schemaDatabaseUrl.searchParams.set(
  "options",
  `-c search_path=${schemaName}`,
);
process.env.DATABASE_URL = schemaDatabaseUrl.toString();
process.env.TACK_BOOTSTRAP = "1";

await migrateDatabase();
const { auth } = await import("../src/lib/auth");
const password = process.env.E2E_ADMIN_PASSWORD ?? "admin-password-123";
const result = await auth.api.signUpEmail({
  body: {
    name: "Alex Kim",
    email: "admin@example.com",
    password,
    initials: "AK",
    color: "rust",
  },
});

const database = getDatabase();
await database.query(
  `UPDATE "user"
   SET role = 'admin', "emailVerified" = TRUE
   WHERE id = $1`,
  [result.user.id],
);
await database.query(
  `INSERT INTO "user" (
     id, name, email, "emailVerified", "createdAt", "updatedAt",
     role, banned, initials, color
   ) VALUES
     (
       'member-maya-chen', 'Maya Chen', 'maya@example.local', TRUE,
       NOW(), NOW(), 'user', FALSE, 'MC', 'blue'
     ),
     (
       'member-sam-rivera', 'Sam Rivera', 'sam@example.local', TRUE,
       NOW(), NOW(), 'user', FALSE, 'SR', 'green'
     )`,
);

await closeDatabase();
console.log("Prepared isolated Playwright database.");
