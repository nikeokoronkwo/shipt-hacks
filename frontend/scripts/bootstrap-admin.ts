import { existsSync } from "node:fs";
import path from "node:path";

async function main() {
  const rootEnvFile = path.resolve(process.cwd(), "..", ".env");
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "ShelterConnect Administrator";
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first super administrator.");
  }

  const { assertAuthConfiguration, auth, database } = await import("../lib/auth");
  assertAuthConfiguration();
  try {
    await auth.api.createUser({
      body: {
        email,
        password,
        name,
        role: "super_admin",
      },
    });
    console.log("Super administrator created.");
  } finally {
    database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
