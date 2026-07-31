# Setting Up Storage

## Storage Backend

findmydoc always stores upload bytes through Payload's S3-compatible storage adapter. PayloadCMS remains the source of truth for media metadata (filename, sizes, alt text, ownership), while the selected S3 backend stores file bytes.

- Development uses the local Adobe S3Mock Docker service.
- Tests and E2E use a separate local Adobe S3Mock service.
- Preview and production use the configured S3-compatible bucket.

## Runtime Modes (Local / Hybrid / Cloud)

Storage and database choices are runtime decisions. The same app can run in different operating modes:

| Mode | Database | Storage | Notes |
| --- | --- | --- | --- |
| `local` | Local Postgres (usually Docker) | Local S3Mock | Day-to-day development with no cloud storage dependency |
| `hybrid` | Remote Postgres (commonly Supabase Postgres) | Local S3Mock | Local app with a selected remote database |
| `cloud` | Managed Postgres (commonly Supabase Postgres) | S3-compatible storage (commonly Supabase Storage via S3 API) | Typical hosted/staging/production setup |

This means "Supabase for database and storage" is valid for hosted operation, while local and hybrid development keep media bytes in local S3Mock.

## Media Ownership Policy (Current)

We keep media collections separated by “who owns this file” because ownership drives access control and storage paths.

- `platformContentMedia` is for platform-owned content (assets used by Pages/Posts and platform-managed content).
  - Read can be public depending on the collection access rules.
  - Create/update/delete are restricted to Platform Staff.
- Clinic-owned uploads go to `clinicMedia`.
  - Read is scoped by access rules.
  - Clinic Staff can create/update/delete only for their assigned clinic.

This separation helps prevent cross-tenant leakage and keeps permissions easy to reason about.

## Storage Paths & Folder Keys

All upload collections use a predictable storage path structure. Conceptually, each stored file lives under:

- a **namespace** (what kind of media it is),
- optionally an **owner** (which clinic/doctor/user it belongs to),
- a short **hash folder** (to avoid collisions and improve caching),
- and the sanitized **original filename**.

This policy is enforced by shared hooks (e.g. the compute-storage hook) so app code does not have to manually build paths.

### Namespaces

Namespaces are the top-level prefixes used to keep storage organized:

- Platform assets (marketing/content) live under a platform namespace.
- Clinic assets live under a clinics namespace.
- Doctor assets live under a doctors namespace.
- User profile assets live under a users namespace.

### Owner segment

Owner-scoped collections include an owner identifier in the path (for example, a clinic id for clinic-owned media). Platform-owned assets typically do not include an owner segment.

### Hash folder key

A hash folder exists to:

- avoid filename collisions,
- distribute objects across folders (avoids “hot spots”),
- improve cache behavior when a file is replaced.

## S3-Compatible Storage (How it is enabled)

S3-compatible storage is configured via the official Payload S3 storage adapter.

Source of truth for this configuration in the repo:
- `src/plugins/index.ts` and `src/plugins/storageConfig.ts`

### Runtime selection

The S3 adapter is active in every runtime. There is no local filesystem fallback.

- Development uses bucket `findmydoc-local` at `http://localhost:9090`. Docker Compose supplies its internal S3Mock address to the Payload container.
- Tests and E2E use bucket `findmydoc-test` at `http://localhost:9091`.
- Preview and production require all `S3_*` variables. Startup fails with the missing variable names if that configuration is incomplete.
- Development and test use AWS SDK checksum validation only when required because S3Mock cannot validate the SDK's optional response checksum for ranged reads. Online S3 backends retain the SDK default validation.

The test harness starts and stops its isolated S3Mock alongside Postgres. S3Mock has no named test-data volume, but its stopped container is retained with the cached Postgres templates between warm runs so baseline media records keep matching objects. `TEST_DB_REBUILD_TEMPLATES=1` removes both states before rebuilding. With `TEST_DB_ALLOW_REMOTE=1`, the harness still starts local S3Mock for the default local endpoint; an explicit external `S3_TEST_ENDPOINT` keeps both remote lifecycles external.

## Current Online Storage Constraint

In the active Supabase-compatible online storage setup, the bucket is currently constrained to `1 MB` per object. This is stricter than the app-level Payload upload guard and is the effective limit for seed and admin uploads in preview/production.

Practical consequence:
- large original photos can fail with `413 EntityTooLarge` even when the Payload request itself is accepted
- seed assets should be source-prepared before upload without making the final browser-delivery compression decision
- the repo includes a small CLI around `sharp` for this: `pnpm images:optimize -- --input <path> --output <path>`
- image delivery policy is documented in `docs/frontend/image-pipeline.md`

### Environment variables (what they mean)

Preview and production require credentials and connection details:

- `S3_ENDPOINT`: The S3 API endpoint URL (often provider-specific).
- `S3_ACCESS_KEY_ID`: Access key id used by the S3 client.
- `S3_SECRET_ACCESS_KEY`: Secret access key used by the S3 client.
- `S3_BUCKET`: The bucket name where uploads are stored.
- `S3_REGION`: The bucket region used by the S3 client.
- `S3_LOCAL_ENDPOINT`: Optional development override. Docker Compose uses `http://s3mock:9090`; host development defaults to `http://localhost:9090`.
- `S3_TEST_ENDPOINT`: Optional test override. Tests default to `http://localhost:9091`.

Missing online values fail application startup before uploads can fall back to local disk. An otherwise unclassified `NODE_ENV=production` process is also treated as production for storage, so it fails fast instead of selecting S3Mock.

### What the storage plugin changes

The S3 adapter disables local disk storage for every upload collection. Payload's existing file proxy and collection access controls remain in place, so internal S3Mock addresses are never used as public media URLs.

## Note: Join fields and “relationship reference” correctness

This is not a storage feature, but it affects how media- and treatment-related data appears in the admin UI and APIs.

Payload join fields are used to surface related documents without duplicating data. For example, clinics use a join field to show related clinic-treatment rows.

Key rule:
- The join field’s `on` setting must point to the relationship field in the joined collection that references the *current* document.

Practical impact:
- If a clinic’s join field points at the wrong relationship (for example, joining on a treatment reference instead of a clinic reference), the join result will be empty or incorrect.
- With the correct reference, a clinic can reliably display all of its offerings (and any extra fields like price) via the junction collection.

## Adding a New Upload/Media Collection (Media-focused)

This section is intentionally scoped to file uploads and media behavior, not general collection modeling.

When adding a new upload-enabled collection in this repo, follow the same pattern used by existing media collections.

### 1) Decide ownership first (this drives everything)

Answer these before writing code:

- Is this **platform-owned** media (usable across the site), or **owner-scoped** media (belongs to a clinic/doctor/user)?
- Who should be allowed to **read** the file metadata and access the file URL?
- Who can **create/update/delete**?

Ownership determines:

- access scope,
- whether an owner id must be present in the storage path,
- and which “namespace” prefix it should use.

### 2) Required metadata for upload collections

For images, require at least:

- `alt` text (accessibility).

For owner-scoped uploads, include a required relationship field such as:

- `clinic` (for clinic-owned media),
- `doctor` (for doctor-owned media),
- `user` (for user-owned media).

Also ensure the collection is aligned with the repo’s soft delete approach where appropriate (media collections typically support trash/soft delete).

### 3) Use hooks to keep media safe and consistent

Existing media collections rely on hooks so behavior stays consistent across the codebase:

- **Freeze ownership after creation**: prevents moving a file between owners.
- **Set created-by metadata**: records who uploaded the file for auditing.
- **Compute storage paths**: enforces the standard path pattern (namespace + optional owner id + hash folder + filename).

These hooks keep business logic out of the frontend and prevent accidental cross-tenant moves.

### 4) S3 storage: register the collection in the storage adapter

If the collection stores files, it must be included in the S3 adapter configuration in `src/plugins/index.ts`.

What you decide there:

- the **prefix/namespace** in the bucket (should match the repo’s naming conventions),
- local disk storage remains disabled for the collection.

If you skip this step, environments will not share the same S3-backed media behavior.

### 5) Validate in three practical scenarios

Before merging, confirm:

- local development uploads use S3Mock,
- preview and production store new uploads in their configured S3 bucket,
- test runs use the isolated S3Mock service and do not reach an external bucket.

## Quick Configuration Guide

### Local S3Mock (Development and Tests)

Run Docker Compose before starting the app. Development and tests select their local S3Mock endpoints automatically; no storage flag or credential setup is required.

### Online S3-Compatible Storage (Preview and Production)

Provide the complete `S3_*` environment configuration before startup. The application does not substitute local disk storage when it is absent.
