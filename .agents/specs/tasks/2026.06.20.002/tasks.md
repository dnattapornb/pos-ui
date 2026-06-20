# Phase: Fix Timezone Skew on created_at / updated_at

**Goal:** Store all timestamps as UTC end-to-end and let the client convert to
local (Asia/Bangkok, +07). Remove the double timezone interpretation between the
`mysql2` driver (default `timezone: 'local'` = +07) and the MySQL server (UTC).

**Decision (reviewed):** Option A — UTC everywhere, convert at the client.
Dev-only data (re-seed allowed). Frontend (`liff-receipt-frontend`) handles the
+07 display conversion.

**Affected files:** `src/app.module.ts`, `docker-compose.yml`,
`.agents/specs/database.md`, `.agents/references/pos-api.md`,
`test/unit/...` (timezone serialization check).

## R2.1 — Pin the database connection to UTC

- [x] Add `timezone: 'Z'` to the TypeORM `mysql` config in `src/app.module.ts` so `mysql2` reads/writes `DATETIME` as UTC without applying a local offset.
- [x] Verify the app still boots and connects (`npm run start:dev` manually, or build).

## R2.2 — Pin the MySQL server timezone to UTC

- [x] Add `command: --default-time-zone=+00:00` to the `mysql` service in `docker-compose.yml` so `CURRENT_TIMESTAMP` (used by `@CreateDateColumn` / `@UpdateDateColumn`) is always UTC regardless of host TZ.
- [x] Recreate the container and confirm session tz: `SELECT @@global.time_zone, @@session.time_zone;` returns `+00:00`.

## R2.3 — Reset dev data

- [x] Re-seed POS data via `POST /pos/seed` (dev-only, truncates POS tables) so timestamps are written under the corrected UTC config.
- [x] (If needed) drop/recreate the schema since `synchronize: true` is on; no production migration required.

## R2.4 — Verify UTC end-to-end

- [x] `GET /pos/products` (via `http/pos.http`) and confirm `createdAt` / `updatedAt` are ISO 8601 UTC (`...Z`) and match the actual insert time with no ±7h skew.
- [x] Cross-check the raw DB value (`SELECT created_at FROM product LIMIT 1;`) equals the UTC time shown in the API response.
- [x] Add/adjust a unit test asserting a known `Date` serializes to the expected UTC ISO string (no offset applied). Place under `test/unit/` mirroring source path.

## R2.5 — Document the timezone policy

- [x] Add a "Timezone Policy" note to `.agents/specs/database.md`: all `DATETIME` columns are stored and returned as **UTC**; clients convert to local.
- [x] Note in `.agents/references/pos-api.md` that `createdAt` / `updatedAt` in responses are UTC ISO 8601 and the client is responsible for converting to Asia/Bangkok (+07).

## R2.6 — Final checks

- [x] Run `npm run build` (or `npx tsc --noEmit`) to confirm type safety.
- [x] Run file-scoped lint on changed files.
- [x] Prepare a conventional commit message (`fix(db): ...`) based on the actual `git diff`.

## Out of Scope / Notes

- Frontend (`liff-receipt-frontend`) owns the +07 display conversion — coordinate via `../liff-receipt-frontend/MASTER_AGENT_PROMPT.md`.
- Rejected alternatives: Option B (switch columns to `TIMESTAMP`) — avoided to keep schema/data stable; Option C (store local +07) — against UTC best practice.
