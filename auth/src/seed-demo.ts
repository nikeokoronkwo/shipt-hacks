/** Local demo provisioning only. Accounts are created through Better Auth. */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { auth, database } from "./auth.js";

const credentialsPath = resolve("../.demo-credentials.json");
try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  const hadCredentials = existsSync(credentialsPath);
  const accounts = hadCredentials
    ? JSON.parse(readFileSync(credentialsPath, "utf8")) as Array<{email: string; password: string; role: "super_admin" | "shelter_admin"; id?: string}>
    : [
      { email: "super-admin@demo.shelterconnect.example", password: randomBytes(24).toString("base64url"), role: "super_admin" as const },
      { email: "shelter-admin@demo.shelterconnect.example", password: randomBytes(24).toString("base64url"), role: "shelter_admin" as const },
    ];
  // Do not invent replacement passwords for accounts already in this database.
  if (!hadCredentials && accounts.some(account =>
    database.prepare('SELECT id FROM "user" WHERE email = ?').get(account.email))) {
    throw new Error("Demo accounts already exist. Restore the original .demo-credentials.json; existing passwords were preserved.");
  }
  // Persist before creating accounts so retries retain the generated passwords.
  writeFileSync(credentialsPath, JSON.stringify(accounts, null, 2) + "\n", { mode: 0o600 });
  for (const account of accounts) {
    const existing = database.prepare('SELECT id, role FROM "user" WHERE email = ?').get(account.email) as {id: string; role: string} | undefined;
    if (existing) {
      if (existing.role !== account.role || (account.id && account.id !== existing.id)) {
        throw new Error(`Existing demo identity mismatch for ${account.email}`);
      }
      account.id = existing.id;
    } else {
      const result = await auth.api.createUser({ body: {
        email: account.email, password: account.password,
        name: `Demo ${account.role}`, role: account.role,
      } });
      account.id = result.user.id;
    }
  }
  writeFileSync(credentialsPath, JSON.stringify(accounts, null, 2) + "\n", { mode: 0o600 });
  console.log("Demo administrators ready. Local credentials: .demo-credentials.json at repository root");
} finally {
  database.close();
}
