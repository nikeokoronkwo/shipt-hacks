import { existsSync } from "node:fs";
import path from "node:path";

import { getMigrations } from "better-auth/db/migration";

async function main() {
  const rootEnvFile = path.resolve(process.cwd(), "..", ".env");
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const { assertAuthConfiguration, auth } = await import("../lib/auth");
  assertAuthConfiguration();

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
