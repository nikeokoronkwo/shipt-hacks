import { betterAuth } from "better-auth";
import { admin, jwt } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import Database from "better-sqlite3";
import { resolve } from "node:path";
import { ac, roles } from "./permissions.js";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
}
export const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
export const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000,http://localhost:5173")
  .split(",").map(s => s.trim()).filter(Boolean);
export const database = new Database(resolve(process.env.AUTH_DB_PATH ?? "../backend/shelterconnect.db"));
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 30000");
database.pragma("journal_mode = WAL");

export const auth = betterAuth({
  secret, baseURL, trustedOrigins, database,
  emailAndPassword: { enabled: true },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/admin/set-role" || ctx.path === "/admin/create-user") {
        const role = ctx.body?.role ?? ctx.body?.data?.role;
        if (role !== undefined && (typeof role !== "string" || !Object.hasOwn(roles, role))) {
          throw new APIError("BAD_REQUEST", { message: "Specify one supported application role" });
        }
      }
    }),
  },
  plugins: [
    admin({ ac, roles, defaultRole: "driver", adminRoles: ["super_admin"] }),
    jwt({
      jwks: { keyPairConfig: { alg: "ES256" } },
      jwt: {
        issuer: baseURL, audience: process.env.JWT_AUDIENCE ?? "shelterconnect-api",
        expirationTime: "15m",
        definePayload: ({ user }) => ({ role: user.role }),
      },
    }),
  ],
});
