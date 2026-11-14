import { mkdirSync } from "node:fs";
import path from "node:path";

import { betterAuth } from "better-auth";
import { admin, jwt } from "better-auth/plugins";
import Database from "better-sqlite3";

import {
  accessControl,
  driverRole,
  shelterAdminRole,
  superAdminRole,
} from "./permissions";

const databaseFile =
  process.env.DATABASE_FILE ??
  path.resolve(process.cwd(), "../data/shelterconnect.sqlite3");
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const hasProductionSecret = Boolean(process.env.BETTER_AUTH_SECRET);

mkdirSync(path.dirname(databaseFile), { recursive: true });
const database = new Database(databaseFile);

// These match the Python SQLAlchemy connection settings. WAL permits a reader
// while the other process writes; the timeout lets a short write wait instead
// of immediately producing a spurious `database is locked` error.
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");
database.pragma("synchronous = NORMAL");

export const auth = betterAuth({
  database,
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-change-this-better-auth-secret-before-deploying",
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      ac: accessControl,
      roles: {
        driver: driverRole,
        shelter_admin: shelterAdminRole,
        super_admin: superAdminRole,
      },
      defaultRole: "driver",
      adminRoles: ["super_admin"],
    }),
    jwt({
      jwt: {
        issuer: baseURL,
        audience: process.env.AUTH_AUDIENCE ?? "shelterconnect-api",
        expirationTime: "15m",
        // Keep FastAPI's authorization input deliberately small and explicit.
        definePayload: ({ user }) => ({ role: user.role }),
      },
      jwks: {
        keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          // Do not overwrite a role selected through Better Auth's protected
          // admin endpoint. Public email/password registration, on the other
          // hand, is always a driver registration.
          if (context?.path !== "/sign-up/email") {
            return { data: user };
          }
          return {
            data: {
              ...user,
              // This is a local demo bootstrap escape hatch; remove the env
              // var in a real deployment.
              role:
                process.env.DEMO_SUPER_ADMIN_EMAIL === user.email
                  ? "super_admin"
                  : "driver",
            },
          };
        },
      },
    },
  },
});

export function assertAuthSecretConfigured(): void {
  if (process.env.NODE_ENV === "production" && !hasProductionSecret) {
    throw new Error("BETTER_AUTH_SECRET must be set in production.");
  }
}
