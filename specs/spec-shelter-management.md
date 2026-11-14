---
title: Complete Ben's shelter database and APIs
type: feature
created: 2026-11-14
status: done
baseline_commit: be3e4bf9943e37f0d57bf29148e914ded60a6f15
context: [specs/ben-work-spec.md, specs/database-spec.md]
---

## Intent
Complete the remaining shelter management responsibilities authorized in Ben's spec: public listing/detail, authorized updates, administrator listing and assignment, and repeatable fictional demo data with Better Auth administrators. Keep existing shared database and authentication contracts usable by Developer 2.

## Boundaries
Use existing SQLAlchemy models and verified JWT dependencies. Preserve Better Auth ownership of authentication schema and account creation. Restrict assignments to existing shelter administrators. Do not implement driver or ride endpoints. Demo credentials must be local, generated, and ignored by git.

## Code Map
- Current API routes: `backend/main.py`; models, validation, and shelter seeding:
  `backend/src/shiptohome/`.
- Better Auth configuration and operator bootstrap: `frontend/lib/auth.ts` and
  `frontend/scripts/bootstrap-admin.ts`.
- Endpoint and authorization regression checks: `backend/tests/test_api.py`.

The modular `backend/app/` and standalone `auth/` implementations described in
the original checklist were consolidated into this shared-database project.

## Tasks & Acceptance
- [x] Add five specified endpoints and model compatibility imports.
- [x] Validate payload types, capacity and assignment eligibility; enforce assignment ownership and timestamps.
- [x] Seed fictional shelters and provide a supported Better Auth admin bootstrap flow.
- [x] Initialize and seed the local SQLite file.
- [x] Verify endpoints, auth and database tests; update Ben's checklist and startup docs.

Given public callers, listing and detail return serialized service arrays and missing detail returns 404. Given a shelter administrator, PATCH succeeds only for assigned shelters. Given a super administrator, PATCH works for every shelter and assignment creation checks the user role and shelter, with duplicate assignments returning 409. Given invalid values, updates return 422 without changing data. Given repeated seeding, no duplicate shelters/accounts/assignments appear and existing availability/passwords remain intact.

## Verification
Run backend pytest, auth TypeScript checking, and the existing real JWT smoke test. Inspect the seeded SQLite database read-only and exercise the demo account login and shelter routes over HTTP.

## Review and Verification

Three independent reviews checked correctness, boundary cases, and acceptance. Fixed signed-64-bit SQLite overflow validation for bed counts and IDs, and rejected demo identity collisions when the original credentials file is missing. Backend: 44 passed, 53 subtests passed. Auth: TypeScript check passed. Real HTTP smoke test verifies the shelter endpoints using issued JWTs. Local shelter and account seeding was run repeatedly without duplicates.

## Suggested Review Order

- API entry points and role requirements: [main.py:1](../backend/main.py#L1)
- Strict payload types and user role checks: [schemas.py:1](../backend/src/shiptohome/schemas.py#L1)
- Local account provisioning: [bootstrap-admin.ts:1](../frontend/scripts/bootstrap-admin.ts#L1)
- Fictional shelter provisioning: [seed.py:1](../backend/src/shiptohome/seed.py#L1)
- Endpoint regression coverage: [test_api.py:1](../backend/tests/test_api.py#L1)
- JWT verification: [test_auth.py:1](../backend/tests/test_auth.py#L1)
