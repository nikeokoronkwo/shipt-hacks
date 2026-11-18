import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const migration = spawnSync(process.execPath, ["--import", "tsx", "scripts/migrate-auth.ts"], {
  stdio: "inherit",
  env: process.env,
});
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

// The preload exists only in the test server's process tree. Production SMS and
// Better Auth's OTP generation, verification, expiry, and attempt limits remain intact.
const preload = path.resolve("tests/support/sms-transport.mjs");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3000"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${JSON.stringify(preload)}`.trim(),
  },
});
server.on("error", error => { throw error; });
server.on("exit", code => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
