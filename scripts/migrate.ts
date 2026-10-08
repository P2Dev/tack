import { closeDatabase, migrateDatabase } from "../src/lib/database";

await migrateDatabase();
console.log("Database migrations are up to date.");
await closeDatabase();
