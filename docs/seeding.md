# Seeding System

This document describes how baseline and demo seeding works in the project after the Phase A & B refactor.

## Overview
We separate **baseline** reference data (idempotent, required) from **demo** sample content (optional, resettable).

| Type | Purpose | Idempotent | Destructive | Prod Allowed | Error Policy |
|------|---------|-----------|-------------|--------------|--------------|
| Baseline | Core reference taxonomy + globals | Yes | No | Yes | Fail-fast |
| Demo | Sample marketing / clinical data for local dev & demos | Best-effort | Resettable (demo only) | No (blocked) | Aggregate (tiered) |

## Collections Classification
Baseline units (ordered):
1. Globals (navigation/footer)
2. Medical Specialties
3. Countries & Cities

Demo units (current):
- Posts
- Clinics
- Doctors
- Treatments (+ relations)
- Reviews

## Execution Paths
You can run seeds in three ways:

### 1. CLI Scripts
`pnpm ts-node scripts/seed-baseline.ts` – runs baseline only.
`pnpm ts-node scripts/seed-demo.ts` – runs demo (includes baseline safety pre-check if needed).

### 2. Payload Endpoint (preferred for dashboard)
POST `/api/seed?type=baseline`
POST `/api/seed?type=demo&reset=1` (optional `reset=1` to clear demo collections first)
GET `/api/seed` – returns cached summary of last run.

Access control: platform staff only. In production, `type=demo` is rejected.

### 3. Legacy `/next/seed` internal route
Used by existing `SeedButton` in the Developer Dashboard. Will migrate to new endpoints in Phase D.

## Tiered Error Handling Policy
- Baseline: first failure aborts and returns HTTP 500 (`status: failed`).
- Demo: runs all units, collecting partial failures.
  - HTTP 200 + `status: ok` if all succeed.
  - HTTP 200 + `status: partial` if some succeed and some fail.
  - HTTP 500 + `status: failed` if all fail.

Summary JSON shape (demo example):
```json
{
  "type": "demo",
  "reset": true,
  "status": "partial",
  "baselineFailed": false,
  "startedAt": "2025-08-11T10:00:00.000Z",
  "finishedAt": "2025-08-11T10:00:01.200Z",
  "durationMs": 1200,
  "totals": { "created": 10, "updated": 2 },
  "units": [ { "name": "posts", "created": 5, "updated": 0 } ],
  "partialFailures": [ { "name": "clinics", "error": "Validation error" } ]
}
```

## Reset Semantics
`reset=1` triggers `clearCollections` on the demo collection list before re-seeding. Baseline collections are never cleared.

## Idempotency
Baseline upserts ensure second run yields `{ created: 0 }` for each unit unless new reference data is added. Demo units skip creating duplicates using slug / unique lookups.

## Adding a New Seed Unit
1. Create function `seed<Domain>` (or `seed<Domain>Demo`) returning `{ created, updated }`.
2. Add it to `baselineSeeds` or `demoSeeds` array preserving order.
3. (Demo) Ensure uniqueness guard to avoid duplicates.
4. (Baseline) Use `upsertByUniqueField` or deterministic update.
5. Add JSDoc and update this doc.
6. Run `pnpm payload migrate:create <name>` then `pnpm payload migrate` if schema changes were involved.

## Cache
Last run summary stored in `global.__lastSeedRun` for quick dashboard/status retrieval.

## Related Docs
- `tmp/seeding-implementation-checklist.md` – task tracking.
- `tmp/seeding-architecture-plan.md` – rationale (link when added).

## Future Work (Phase C/D)
- Test fixtures reuse seed units.
- Developer Dashboard replaces legacy button with two explicit seed actions + status panel.
