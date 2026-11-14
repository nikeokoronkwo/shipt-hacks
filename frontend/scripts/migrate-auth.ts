import { getMigrations } from "better-auth/db/migration";

import { auth } from "../lib/auth";

async function main() {
  const migration = await getMigrations(auth.options, { throwOnUnsafe: true });

  if (migration.schemaProblems.length > 0) {
    throw new Error(`Better Auth schema problems:\n${migration.schemaProblems.join("\n")}`);
  }

  await migration.runMigrations();

  console.log(
    `Better Auth schema is ready (${migration.toBeCreated.length} table(s) created, ` +
      `${migration.toBeAdded.length} table alteration(s), ` +
      `${migration.toBeAddedIndexes.length} index(es)).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
