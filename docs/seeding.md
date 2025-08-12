# Seeding System

This document describes how baseline and demo seeding works.

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

Demo reset collection list (ordered for safe clearing):
1. reviews (depends on treatments, doctors, clinics, posts)
2. clinictreatments (join records)
3. treatments (depends on clinics, doctors, specialties)
4. doctors (depends on clinics, specialties)
5. clinics (depends on cities)
6. posts

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
Baseline (critical): first failure aborts and returns HTTP 500 (`status: failed`).

Demo (best‑effort): run every unit, collect errors.
* HTTP 200 + `status: ok` when all succeed
* HTTP 200 + `status: partial` when mix of success + failure
* HTTP 500 + `status: failed` when all fail (signals unusable demo state)

No automatic retry: failures should be visible and fixed at source.

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

## Reset Semantics & Counts
`reset=1` triggers `clearCollections` for the demo collection list before seeding. Baseline collections are never cleared.

When `reset=1` the system records per-collection counts before and after seeding (`beforeCounts`, `afterCounts`) to verify that data was actually cleared and repopulated.

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

## Decisions
* Tiered error policy confirmed (baseline fail‑fast, demo aggregate)
* No retry layer (keep behavior transparent, simplicity > silent recovery)
* Before/after counts exposed for demo reset verification

## Future Work
* Optional additional demo units (pages/forms) if required
* Potential CLI wrapper for combined baseline+demo run with summary export
