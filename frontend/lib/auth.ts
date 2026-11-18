import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, jwt, phoneNumber } from "better-auth/plugins";
import Database from "better-sqlite3";

import { sendSms } from "./sms";
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
const audience = process.env.AUTH_AUDIENCE ?? "shelterconnect-api";
const applicationRoles = {
  driver: driverRole,
  shelter_admin: shelterAdminRole,
  super_admin: superAdminRole,
} as const;
const trustedOrigins = [
  baseURL,
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export function assertAuthConfiguration(): void {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.includes("replace-with")) {
    throw new Error("Set BETTER_AUTH_SECRET to a random value of at least 32 characters.");
  }
}

// Fail before serving auth routes if the session/JWT secret is missing or a
// copied example value is still in use.
assertAuthConfiguration();

mkdirSync(path.dirname(databaseFile), { recursive: true });
export const database = new Database(databaseFile);

// These match the Python SQLAlchemy connection settings. WAL permits a reader
// while the other process writes; the timeout lets an active write finish
// instead of immediately producing a spurious `database is locked` error.
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 30000");
database.pragma("synchronous = NORMAL");

export const auth = betterAuth({
  database,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    revokeSessionsOnPasswordReset: true,
  },
  plugins: [
    admin({
      ac: accessControl,
      roles: applicationRoles,
      defaultRole: "driver",
      adminRoles: ["super_admin"],
    }),
    jwt({
      jwt: {
        expirationTime: "15m",
        issuer: baseURL,
        audience,
        // FastAPI receives only the authorization and verified contact claims
        // needed for driver APIs. It never trusts a phone supplied in a body.
        definePayload: ({ user }) => ({
          role: user.role,
          phone_number: user.phoneNumber ?? null,
          phone_number_verified: user.phoneNumberVerified === true,
        }),
      },
      jwks: {
        keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
      },
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 3,
      requireVerification: true,
      phoneNumberValidator: (phoneNumber) => /^\+[1-9]\d{7,14}$/.test(phoneNumber),
      sendOTP: async ({ phoneNumber: to, code }) => {
        try {
          await sendSms({
            to,
            body: `Your ShelterConnect verification code is ${code}. It expires in 5 minutes. Don't share it. Reply STOP to stop all ShelterConnect texts.`,
          });
        } catch {
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: "We couldn't send your verification code. Please try again shortly.",
          });
        }
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => {
          const identifier = createHash("sha256").update(phoneNumber).digest("hex").slice(0, 24);
          return `driver-${identifier}@phone.shelterconnect.invalid`;
        },
        getTempName: () => "ShelterConnect Driver",
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/admin/set-role" && context.path !== "/admin/create-user") {
        return;
      }
      const requestedRole = context.body?.role ?? context.body?.data?.role;
      if (
        requestedRole !== undefined &&
        (typeof requestedRole !== "string" || !Object.hasOwn(applicationRoles, requestedRole))
      ) {
        throw new APIError("BAD_REQUEST", {
          message: "Specify one supported ShelterConnect role.",
        });
      }
    }),
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Match Better Auth's internal route path, without the /api/auth prefix.
      "/phone-number/send-otp": { window: 60, max: 3 },
    },
  },
  // Await OTP delivery so a missing/rejected SMS provider is an error rather
  // than a successful "code sent" response with no message on the way.
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          // Only the protected admin create-user endpoint can create a
          // non-driver account. Every public signup path defaults to driver.
          if (context?.path === "/admin/create-user") {
            return { data: user };
          }
          return {
            data: {
              ...user,
              role: "driver",
              // Phone verification also signs existing users in. Apply the
              // optional signup name only while creating a new account.
              ...(context?.path === "/phone-number/verify" &&
              typeof context.body?.name === "string" &&
              context.body.name.trim().length > 0 &&
              context.body.name.trim().length <= 100
                ? { name: context.body.name.trim() }
                : {}),
            },
          };
        },
      },
    },
  },
});
