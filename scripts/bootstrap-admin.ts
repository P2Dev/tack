import {
  closeDatabase,
  getDatabase,
  migrateDatabase,
} from "../src/lib/database";

const email = process.env.TACK_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.TACK_ADMIN_PASSWORD;
const name = process.env.TACK_ADMIN_NAME?.trim() || "Tack Admin";
const color = process.env.TACK_ADMIN_COLOR?.trim() || "rust";

if (!email || !password) {
  console.log(
    "Admin bootstrap skipped: TACK_ADMIN_EMAIL and TACK_ADMIN_PASSWORD are not set.",
  );
  process.exit(0);
}

if (password.length < 10 || password.length > 128) {
  throw new Error("TACK_ADMIN_PASSWORD must be between 10 and 128 characters.");
}

process.env.TACK_BOOTSTRAP = "1";
await migrateDatabase();

const database = getDatabase();
const existing = await database.query<{ id: string }>(
  `SELECT id FROM "user" WHERE LOWER(email) = $1`,
  [email],
);

if (existing.rows[0]) {
  await database.query(
    `UPDATE "user"
     SET role = 'admin', banned = FALSE, "banReason" = NULL,
         "banExpires" = NULL, "updatedAt" = NOW()
     WHERE id = $1`,
    [existing.rows[0].id],
  );
  console.log(`Confirmed ${email} as an active Tack administrator.`);
} else {
  const { auth } = await import("../src/lib/auth");
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
      initials: name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
      color: color as
        | "rust"
        | "blue"
        | "gold"
        | "green"
        | "slate"
        | "violet",
    },
  });

  await database.query(
    `UPDATE "user"
     SET role = 'admin', "emailVerified" = TRUE, "updatedAt" = NOW()
     WHERE id = $1`,
    [result.user.id],
  );
  console.log(`Created Tack administrator ${email}.`);
}

await closeDatabase();
