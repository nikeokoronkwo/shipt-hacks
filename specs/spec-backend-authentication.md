---
title: Backend authentication
type: feature
status: done
created: 2026-11-14
baseline_commit: ed216be0a5b292464d716a1b2f5d52141054139a
---

<frozen-after-approval>

## Intent

Implement the four authentication steps approved by Ben: Better Auth service, trusted roles, FastAPI JWT integration, and end-to-end verification/documentation. Deliver reusable authentication for Gavin.

## Boundaries & Constraints

Use Better Auth for passwords, sessions, auth migrations and role administration. Public signup assigns driver on the server. Only super_admin may manage users through HTTP. FastAPI verifies signed short-lived JWTs through cached JWKS. Preserve the current database interfaces. Shelter and transportation features are later iterations. Do not push changes.

## Expected behavior

Given a public signup, when a role is supplied, then no privileged role is granted. Given a valid session, when requesting a JWT, then it identifies the user and trusted role. Given missing, malformed, expired, incorrectly signed or incorrectly scoped tokens, when calling a protected route, then return 401. Given a valid user with the wrong role, when accessing a restricted route, then return 403. Given logout, when retrieving the session, then no active session remains. Previously issued JWTs expire within 15 minutes.

</frozen-after-approval>

## Code Map

- auth/src/auth.ts: Better Auth and SQLite configuration.
- auth/src/permissions.ts: explicit role permissions.
- auth/src/server.ts: HTTP adapter and browser origins.
- auth/src/migrate.ts: supported auth migration operation.
- auth/src/bootstrap-admin.ts: local initial administrator provisioning.
- backend/app/auth/: JWT validation and shared dependencies.
- backend/app/main.py: identity route and CORS.

## Tasks & Acceptance

- [x] Build auth service and trusted roles.
- [x] Implement FastAPI dependencies and identity endpoint.
- [x] Verify authentication and authorization, including adversarial tokens and role escalation.
- [x] Document startup/configuration and update Ben's acceptance checklist.

## Design Notes

Use one explicitly configured SQLite file with independent table ownership, WAL and busy timeout. Exact role checks have no implicit super administrator override. Use ES256 JWTs with issuer and audience checks. A local bootstrap script creates the first super administrator using supported Better Auth APIs, never raw SQL. Credentials come from environment variables.

## Verification

Run TypeScript type checking, Python JWT tests and a real HTTP smoke test against both services with a temporary database. Include persistence after service restart and protected role management.

## Spec Change Log

Approved intent carried forward from Ben's instruction to execute the proposed plan.

## Verification Results

- TypeScript: `npm run check` passed.
- Python: 15 JWT, role, malformed-claim, and JWKS cooldown tests passed.
- Real HTTP smoke test: signup rejects role injection; drivers cannot administer users; valid JWTs reach FastAPI; sessions and signing keys survive restart; login/logout and administrator role changes work; configured browser origin is allowed.
- Review fixes: restrict administrator assignments to a single supported role, retain tsx in production dependencies, trim CORS origins, handle malformed claim types, and explicitly require PyJWT's JWKS refresh cooldown support.

## Suggested Review Order

- Identity, session, roles, and signing configuration.
  [auth.ts:1](../auth/src/auth.ts#L1)
- Explicit administrator permissions.
  [permissions.ts:1](../auth/src/permissions.ts#L1)
- JWT signature and claim validation.
  [jwt.py:1](../backend/app/auth/jwt.py#L1)
- Shared identity and role dependencies.
  [dependencies.py:1](../backend/app/auth/dependencies.py#L1)
- Startup and integration documentation.
  [README.md:1](../auth/README.md#L1)
- Automated cross-service verification.
  [smoke_auth.py:1](../backend/tests/smoke_auth.py#L1)
