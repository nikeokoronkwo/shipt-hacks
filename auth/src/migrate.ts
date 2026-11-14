import { getMigrations } from "better-auth/db/migration";
import { auth, database } from "./auth.js";

try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.log("Authentication schema is up to date");
} finally {
  database.close();
}
