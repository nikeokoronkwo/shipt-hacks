---
title: Make driver registration recoverable across auth and the API
type: bugfix
created: 2026-11-14
updated: 2026-11-18
status: in-review
baseline_commit: 387dcbb
context: []
---

## Intent

**Problem:** Account creation can succeed while backend profile initialization fails. The signup form then attempts another account creation, which fails because that email is already registered. Dashboard setup navigation sends the user back to sign-in instead of profile setup. Email-registered drivers also cannot change SMS consent because the preferences endpoint still requires verified-phone JWT claims that registration no longer requires.

**Approach:** Separate account creation from resumable profile setup on the existing signup route. Confirm the current session, distinguish a missing profile from a backend outage, preserve entered details during retries, and show success only after persistence. Align the preferences endpoint with current main's local-demo registration contract. Return SMS delivery failures instead of false success.

## Boundaries & Constraints

- Preserve current main's phone and vehicle schema and automatic verification for the local demo. New profiles remain offline; SMS consent defaults off.
- Better Auth owns accounts, credentials, sessions, phone OTP generation/verification, and JWT signing. FastAPI trusts signed identity and roles. Never accept another user's ID or online availability from registration input.
- Contact details in the profile request follow the existing local-demo API. Preferences change only consent and cannot silently overwrite registered contact from unrelated token claims.
- Preserve the signup route and current branding. Keep developer credentials, databases, and unrelated local files out of the commit.
- Replace SMS delivery only in test-process support files. No production OTP bypasses, real test SMS, infrastructure changes, or PR merge.
- Push a fresh fix branch and PR targeting current main, as explicitly requested by the user.

## Input and Edge Cases

- New email account: create the account, then save phone, vehicle make/model/color/license plate, and optional alert consent without requiring SMS delivery.
- New SMS account: verify an OTP, create the session, optionally name a new account, and complete the same vehicle setup. Returning SMS users retain their existing names.
- Incomplete account: resume from the current session or sign in again without trying to register the same email twice.
- Existing profile: offer the dashboard and preserve stored consent rather than reinitializing on load.
- Backend lookup outage: show retry instead of treating it as a missing profile. Initialization failure: retain entered details and consent for another attempt.
- Wrong OTP or delivery failure: show an actionable error, avoid false success, and permit retry. Never log real OTPs or provider response bodies.
- Administrator session: explain the driver-only restriction and offer sign-out; backend rejects admin initialization.

## Code Map

- `frontend/components/driver-registration.tsx`: existing route-facing export.
- `frontend/components/driver-signup.tsx`: account/session/profile state and retryable forms.
- `frontend/components/driver-dashboard.tsx`: setup recovery link.
- `frontend/components/forms.tsx`: removed obsolete driver preview variant.
- `frontend/lib/api.ts`: HTTP status errors so lookup 404 is distinguishable from outages.
- `frontend/lib/auth.ts`: awaited SMS failures and create-only SMS display names.
- `backend/main.py`: preferences endpoint aligned with email registration.
- `backend/tests/test_driver_signup.py`: signed JWT, role, schema, persistence, and CORS checks.
- `frontend/playwright.config.ts`, `frontend/tests/driver-signup.spec.ts`, `frontend/tests/support/`: real-service browser tests and isolated SMS transport.
- `README.md`: diagnosis, setup recovery, configuration, and test instructions.

## Tasks & Acceptance

- [x] Replace one-shot signup with account creation and resumable profile setup.
- [x] Recognize existing profiles, distinguish 404/outages, and repair dashboard setup navigation.
- [x] Preserve vehicle, contact, consent, and current demo verification behavior.
- [x] Make SMS preference updates work for email accounts without replacing registered contact.
- [x] Await SMS delivery and protect returning users' saved display names.
- [x] Add active-backend and full-stack browser regression tests.
- [x] Run final checks and review the implementation against the current-main contract.
- [ ] Commit, push, create the fresh PR, and verify its remote state.

**Acceptance Criteria:**
- Given a visitor, when they follow homepage signup and save their account and vehicle details, then one driver profile persists and the live dashboard displays it offline.
- Given failed initialization, when the user retries or reloads and resumes setup, then registration completes using the same saved account.
- Given a completed registration, when consent is changed and the user reloads or signs in again, then the profile, vehicle, and selected preference persist.
- Given anonymous, invalid-token, administrator, or forged-identity requests, when registration is attempted, then unauthorized profiles cannot be created.
- Given SMS-only signup or login, when verification succeeds, then the session can complete registration; wrong codes and failed delivery never claim successful verification.
- Given the final fix, when the remote branch and PR are inspected, then the fresh PR targets current main and includes the written solution and verification evidence.

## Verification

- Run active JWT, database, and signup unittest modules using temporary databases.
- Run frontend lint, TypeScript, a production build, and the full Playwright suite.
- Browser tests use real Next.js/Better Auth, JWT/JWKS verification, FastAPI, and one temporary SQLite database. Only SMS delivery and intentional network-failure injection are replaced.
- Existing shelter selection, pickup, and navigation tests run alongside registration.
- Report the three pre-existing full-discovery import errors from obsolete `app.*` test modules separately; do not hide or skip them silently.
- Confirm the remote PR head matches the tested commit and targets main.

## Spec Change Log

- Investigation initially found a preview-only signup and no profile initialization UI. Main advanced to `387dcbb` during the session, adding vehicle registration and automatic verification for the local demo. Rebased the fix and re-derived the UI/tests around that current contract rather than restoring the obsolete verified-phone initialization contract.
- Review identified a returning SMS user's name could be overwritten by a signup-only optional name. Apply that name only in the new-user creation hook.

## Verification Results

- Active backend suite: 17 tests passed, including 8 new signup regressions with real signature checks and temporary SQLite.
- Full Playwright suite: 13 tests passed against real auth/API services. Verified email setup resume/retry, vehicle/consent persistence, dashboard preference changes, SMS signup/login, wrong-code rejection, returning-name preservation, delivery errors, CORS, and existing shelter/pickup/navigation integrations.
- Frontend lint and TypeScript checks passed. Production `npm run build` passed with a generated test secret and temporary database; the sandbox compilation was stopped and the identical check succeeded outside the sandbox.
- Full backend discovery retains three pre-existing import errors in obsolete `app.*` test modules. No real SMS was sent, and no developer database was used by the new checks.
- Independent reviews found no remaining actionable defects after fixing returning SMS account name preservation.

## Suggested Review Order

- Start with the resumable account and profile states.
  [driver-signup.tsx:28](../frontend/components/driver-signup.tsx#L28)
- Follow profile persistence and retry handling.
  [driver-signup.tsx:101](../frontend/components/driver-signup.tsx#L101)
- Check email-account consent updates preserve registered contact.
  [main.py:270](../backend/main.py#L270)
- Check awaited SMS delivery and new-account-only display names.
  [auth.ts:99](../frontend/lib/auth.ts#L99)
- Review real-service regression coverage and test isolation.
  [driver-signup.spec.ts:70](../frontend/tests/driver-signup.spec.ts#L70)
  [playwright.config.ts:7](../frontend/playwright.config.ts#L7)
  [test_driver_signup.py:1](../backend/tests/test_driver_signup.py#L1)
