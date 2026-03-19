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

## Execution Path
The Developer Dashboard is the primary operator entrypoint.

Endpoints used by the widget:
- `POST /api/seed?type=baseline`
- `POST /api/seed?type=demo&reset=1` (optional `reset=1` to clear demo collections first)
- `GET /api/seed?runId=<runId>` – reload the current run snapshot
- `GET /api/seed/advance?runId=<runId>` – advance the next queued job for a run

Behavior:
- The widget stores only the active `runId` locally.
- The server stores the run record, per-job state, and append-only logs in Payload KV.
- Reloads use `runId` to restore the exact run instead of reconstructing it from local browser state.
- Media-heavy steps are chunked before queueing so each job stays small enough for the hosted runtime.

Access control: platform staff only.

POST policy:
- POST is enabled in `preview`, `development`, and `test`.
- POST is disabled in `production` and returns HTTP `405`.
- Runtime policy stays strict: demo and reset are blocked in production.

### Why the job queue exists
Media-heavy seed runs can exceed a single request timeout in hosted environments. The job queue moves uploads and collection writes into smaller background chunks while keeping the operator flow in the dashboard.

This keeps the dashboard responsive, makes retries easier, and avoids the 60-second request ceiling for large media batches.


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
- **Header**: About, Treatments, Doctors, Clinics, Posts, Contact
- **Footer**: Privacy Policy, Imprint, About, Careers, Contact, Posts
- **Implementation**: Direct `updateGlobal` calls (always returns `created: 0, updated: 2`)

### 2. Medical Specialties
**Data Source**: `src/endpoints/seed/data/baseline/medicalSpecialties.json`
**Purpose**: Curated L1/L2 taxonomy for landing navigation and treatment mapping.
- **L1 root categories**: Dental; Eye Care; Hair Restoration; Dermatology; Plastic Surgery
- **L2 families**: Dental Implants; Orthodontics; Cosmetic Dentistry; Restorative Dentistry; Lens Surgery; Laser Vision Correction; Cataract Surgery; Cornea; Scalp Hair Transplant; Facial Hair Transplant; Hair Loss Therapy; Injectables; Skin Conditions; Laser Dermatology; Facial Surgery; Breast Surgery; Body Contouring
- **Implementation**: Two-pass upsert (L1 first, then L2 with `parentSpecialty` references)
- **Feature images**: Specialty images are seeded through baseline `platformContentMedia` and attached in a second specialty pass when a platform user is available for media attribution.
- **Asset preparation**: Use `pnpm images:optimize` before uploading new specialty images into storage-backed environments. Current project setup uses a Supabase storage bucket with a `1 MB` object limit in the active free-plan environment, so raw photo exports can fail even when Payload accepts the request. In local development, storage-backed uploads still require explicit opt-in via `USE_S3_IN_DEV=true`.

#### Specialty Image Optimization Workflow
- Default preset for category or taxonomy imagery: `pnpm images:optimize -- --input src/endpoints/seed/assets/baseline/medical-specialties --output tmp/medical-specialties --preset category`
- Recommended defaults for category imagery:
  - format: `webp`
  - max width: `1600`
  - start quality: `80`
  - minimum quality floor: `60`
  - target byte budget: `700000`
- The optimizer progressively reduces quality and, if needed, width until it fits within the target byte budget.
- If you need a larger editorial or hero asset, use the `hero` preset and/or override width and byte budget explicitly.

#### Medical Specialties Permittierung (MVP)
- Entries are included only after professional review; the curated repo seed JSON is the technical source of truth.
- Permittierung means an entry is approved only when it exists in `medicalSpecialties.json`.
- Only levels 1 and 2 are allowed in `medical-specialties`; each L2 must map to exactly one L1 parent.
- Level-3 candidates are excluded from this collection and moved to follow-up treatment curation ([management#68](https://github.com/findmydoc-platform/management/issues/68)).
- Entries marked as optional or deleted in source curation (for example `Hollywood Smile`, `Female Hair Transplant`, or deleted duplicates) are excluded from baseline seeds.
- No algorithmic L3 detection is used in runtime code; curation happens before seeding.

### 3. Accreditations
**Data Source**: `src/endpoints/seed/data/baseline/accreditations.json`
**Purpose**: Healthcare quality certifications that clinics can hold.
- **Included**: JCI, ISO 9001, TEMOS, ACHS, and additional common accreditations (with country, abbreviation, description)
- **Implementation**: Upsert by `abbreviation` (unique); descriptions stored as rich text

### 4. Countries & Cities
**Data Sources**:
- `src/endpoints/seed/data/baseline/countries.json`
- `src/endpoints/seed/data/baseline/cities.json`
**Purpose**: Geographic reference data for medical tourism.
- **Countries**: Turkey (ISO codes, language, currency)
- **Turkey Cities**: Istanbul, Ankara, Izmir, Antalya, Bursa
- **Implementation**: Countries first, then cities with country references

### 5. Treatments
**Data Source**: `src/endpoints/seed/data/baseline/treatments.json`
**Purpose**: Canonical list of medical treatments for platform relationships.
- **Included**: Catalog across Dental, Eye Care, Hair Restoration, Plastic Surgery, and Dermatology
- **Implementation**: Depends on medical specialties; maps each treatment to an existing subcategory and maintains idempotent upserts
- **Dependencies**: Medical specialties must be seeded first

### 6. Tags
**Data Source**: `src/endpoints/seed/data/baseline/tags.json`
**Purpose**: Content taxonomy for posts, clinics, and treatments.
- **Included**: Safety, Recovery, Costs, Technology, Accreditation
- **Implementation**: Simple upsert with auto-generated slugs

### 7. Categories
**Data Source**: `src/endpoints/seed/data/baseline/categories.json`
**Purpose**: Blog post categorization system.
- **Included**: Health & Wellness, Medical Tourism, Clinic Reviews
- **Implementation**: Simple upsert with auto-generated slugs

## Asset Layout
Seed assets stay under the same root and are separated by dataset:

- `src/endpoints/seed/assets/baseline/**` for baseline media
- `src/endpoints/seed/assets/demo/**` for demo media

This keeps assets side-by-side while making baseline and demo ownership explicit.

## Adding a New Seed Unit
1. Create function `seed<Domain>` (or `seed<Domain>Demo`) returning `{ created, updated }`.
2. Add it to `baselineSeeds` or `demoSeeds` array preserving order.
3. (Demo) Ensure uniqueness guard to avoid duplicates.
4. (Baseline) Use `upsertByUniqueField` or deterministic update.
5. Add JSDoc and update this doc.
6. Run `pnpm payload migrate:create <name>` then `pnpm payload migrate` if schema changes were involved.

## Run State
Seed runs are persisted in Payload KV:

- `seed:run:<runId>` stores the full run snapshot, job records, and append-only logs.
- `seed:active` stores the currently active run id.
- `seed:latest` stores the most recent run id for the dashboard view.

## Related Docs
- `src/endpoints/seed/utils/plan.ts` – baseline/demo unit ordering
- `src/endpoints/seed/baseline/run-baseline.ts` – baseline orchestration
- `src/endpoints/seed/demo/run-demo.ts` – demo orchestration

## Decisions
* Tiered error policy confirmed (baseline fail‑fast, demo aggregate)
* No retry layer (transparent failures; simplicity prioritized)
* Before/after counts exposed for demo reset verification

## Future Work
* Optional additional demo units (pages/forms) if required (create follow-up issue)
* Revisit chunk sizing and queue tuning once a long-term seed/data strategy is defined
* Integration tests for partial / failed demo scenarios

## Developer Dashboard Seeding Widget
The admin dashboard exposes a **Developer seeding** widget backed by the endpoints above.

Buttons:
* Seed Baseline – Starts a queued baseline run.
* Seed Demo (Reset) – Clears demo collections and then starts a queued demo run. Disabled in production. Requires platform user.
* Refresh Status – Re-fetches the current run snapshot using the stored `runId`.
* Copy Logs / Export `.log` / Export `.json` – Client-side utilities for sharing run output.

Statuses:
* queued – Jobs are queued but not yet started.
* running – At least one job is active.
* completed – All jobs succeeded.
* partial – At least one job failed, others completed or were skipped.
* failed – No job completed successfully.
* cancelled – Remaining queued jobs were cancelled after a fail-fast stop.

Metrics:
* Progress bar: completed jobs / total jobs.
* Units: per-job created / updated counts (shown as summary cards above the log console).
* Log console: append-only stream with `INFO`, `WARN`, and `ERROR` lines.
* Stored state: only the active `runId` is kept in the browser; the job list is restored from the server on reload.

Hosted behavior:
* POST seed execution is disabled in production.
* The dashboard remains the operator-facing entrypoint in preview and production.
* Runtime safety policy remains enforced server-side (no demo/reset in production).

Security / Roles:
* Only platform users can invoke endpoints.
* Non-platform users see a hint-only widget view (no actions, no log output).

Error visibility:
* Job errors are appended to the log console and remain visible after reload.
* No automatic retry is performed.

Developer notes:
* UI reads the latest or requested run via `GET /api/seed`.
* The browser stores the active `runId` only; the job list and logs are reconstructed from the server on reload.
