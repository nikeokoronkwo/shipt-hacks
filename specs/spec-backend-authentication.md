# Unified authentication and authorization

The active implementation is one Next.js + FastAPI application. Better Auth
runs inside the frontend Next.js route at `/api/auth/*`; there is no standalone
auth service. See the root [README](../README.md) for setup and the shared
SQLite contract.

## Runtime contract

- Better Auth owns identity, password credentials, sessions, roles, phone OTP
  state, and JWKS signing keys in the shared SQLite file.
- Public email and phone signups are always `driver`. A request cannot grant an
  elevated role.
- Only `super_admin` can manage roles through Better Auth's Admin plugin. The
  server hook accepts only `driver`, `shelter_admin`, or `super_admin`.
- Drivers can use phone OTP through Twilio or email/password followed by phone
  verification. FastAPI takes the driver phone only from the signed verified
  phone claim, never from a request body.
- New-ride SMS is opt-in. Twilio handles STOP suppression; FastAPI also clears
  the local alert preference when Twilio reports an opted-out recipient.
- Better Auth issues 15-minute EdDSA JWTs. FastAPI checks the exact algorithm,
  key ID, signature, issuer, audience, expiration, subject, role, and any phone
  claim using a cached JWKS client.
- FastAPI owns shelters, driver profiles, shelter assignments, and ride
  requests. It never changes Better Auth tables; Better Auth migrations never
  change FastAPI tables.

## Source map

- [frontend/lib/auth.ts](../frontend/lib/auth.ts): Better Auth plugins,
  protected role assignment, JWT claims, OTP delivery, and shared SQLite.
- [frontend/app/api/auth/[...all]/route.ts](../frontend/app/api/auth/%5B...all%5D/route.ts):
  Next.js auth handler.
- [frontend/scripts/migrate-auth.ts](../frontend/scripts/migrate-auth.ts):
  Better Auth schema migration.
- [frontend/scripts/bootstrap-admin.ts](../frontend/scripts/bootstrap-admin.ts):
  local first-admin provisioning through Better Auth's server API.
- [backend/src/shiptohome/auth.py](../backend/src/shiptohome/auth.py): JWT/JWKS
  verification and role dependency.
- [backend/main.py](../backend/main.py): role-protected domain operations.

## Verification

The backend unit suite checks accepted roles, invalid and malformed JWTs,
verified phone claims, application-table ownership, SQLite writer settings,
and ride constraints:

```sh
cd backend && uv run python -m unittest discover -s tests -v
```
