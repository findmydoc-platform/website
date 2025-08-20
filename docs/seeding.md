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
3. Accreditations
4. Countries & Cities
5. Treatments
6. Tags
7. Categories

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

## Baseline Seed Units

### 1. Globals (Header/Footer Navigation)
**Module**: `src/endpoints/seed/globals/globals-seed.ts`
**Purpose**: Seeds deterministic navigation structure for website header and footer.
- **Header**: About, Treatments, Doctors, Clinics, Blog, Contact
- **Footer**: Privacy Policy, Terms, About, Careers, Contact, Blog
- **Implementation**: Direct `updateGlobal` calls (always returns `created: 0, updated: 2`)

### 2. Medical Specialties
**Module**: `src/endpoints/seed/medical/medical-specialties-seed.ts`
**Purpose**: Hierarchical medical taxonomy with parent-child relationships.
- **Root categories**: Aesthetics & Cosmetic Medicine; Alternative & Holistic Medicine; Dentistry & Oral Health; Dermatology & Skin; Diagnostics & Imaging; Eye, ENT & Ophthalmology; General Practice & Primary Care; Medicine (Non-Surgical Specialties); Mental Health & Behavioural Sciences; Pediatrics; Rehabilitation & Physical Therapy; Surgery; Transplant Medicine; Weight Management & Metabolic; Wellness, Longevity & Spa; Women’s Health & Fertility
- **Implementation**: Two-pass upsert (parents first, then children with `parentSpecialty` references)

### 3. Accreditations
**Module**: `src/endpoints/seed/medical/accreditations-seed.ts`
**Purpose**: Healthcare quality certifications that clinics can hold.
- **Included**: JCI, ISO 9001, TEMOS, ACHS, and additional common accreditations (with country, abbreviation, description)
- **Implementation**: Upsert by `abbreviation` (unique); descriptions stored as rich text

### 4. Countries & Cities
**Module**: `src/endpoints/seed/locations/countries-cities-seed.ts`
**Purpose**: Geographic reference data for medical tourism.
- **Countries**: Turkey (ISO codes, language, currency)
- **Turkey Cities**: Istanbul, Ankara, Izmir, Antalya, Bursa
- **Implementation**: Countries first, then cities with country references

### 5. Treatments
**Module**: `src/endpoints/seed/medical/treatments-seed.ts`
**Purpose**: Canonical list of medical treatments for platform relationships.
- **Included**: Catalog across Hair Transplant, Plastic Surgery, Dentistry, Ophthalmology, Bariatric & Metabolic, Oncology, Fertility/Women’s Health, Medical Aesthetics, and Neurology
- **Implementation**: Depends on medical specialties; maps each treatment to an existing subcategory and maintains idempotent upserts
- **Dependencies**: Medical specialties must be seeded first

### 6. Tags
**Module**: `src/endpoints/seed/content/tags-seed.ts`
**Purpose**: Content taxonomy for posts, clinics, and treatments.
- **Included**: Safety, Recovery, Costs, Technology, Accreditation
- **Implementation**: Simple upsert with auto-generated slugs

### 7. Categories
**Module**: `src/endpoints/seed/content/categories-seed.ts`
**Purpose**: Blog post categorization system.
- **Included**: Health & Wellness, Medical Tourism, Clinic Reviews
- **Implementation**: Simple upsert with auto-generated slugs

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
* Optional additional demo units (pages/forms) if required (create follow-up issue)
* Potential CLI wrapper for combined baseline+demo run with summary export
* Integration tests for partial / failed demo scenarios

## Developer Dashboard Seeding Card
The **Developer Dashboard** (feature-gated by `FEATURE_DEVELOPER_DASHBOARD=true`) exposes a *Seeding* card backed by the endpoints above.

Buttons:
* Seed Baseline – Runs baseline seeds (idempotent, always allowed including production).
* Seed Demo (Reset) – Clears demo collections (ordered list) then re-seeds demo data. Hidden / disabled in production. Requires platform user.
* Refresh Status – Re-fetches the cached last run summary without triggering a new run.

Statuses:
* ok – All units succeeded.
* partial – Demo only: at least one unit failed, others succeeded (see `partialFailures`).
* failed – Baseline: first failure aborted. Demo: all units failed.

Metrics:
* Totals: aggregated created / updated counts.
* Units: per-seed-unit created / updated counts.
* (Reset only) beforeCounts / afterCounts: per collection document counts before clearing and after reseeding (verifies reset effectiveness).

Production behavior:
* Demo button hidden (frontend) and additionally blocked server-side.
* Baseline button always available (safe idempotent upserts).

Security / Roles:
* Only platform users can invoke endpoints; UI also hides actions for non‑platform roles (defense-in-depth).

Error visibility:
* Partial failures are listed with each failing unit's error message. No automatic retry is performed.

Developer notes:
* UI reads last run via `GET /api/seed` (in-memory cache). A fresh POST updates the cache.
* If cache is empty (first load) the card shows no last run until a run completes.

