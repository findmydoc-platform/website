# Setting Up Storage

## Storage Options

The findmydoc portal supports two storage options:

1. **Local Storage**: Files stored on your server's filesystem (default in development)
2. **S3-Compatible Storage**: Files stored in cloud storage using an S3-compatible provider (standard for production)

In both cases, PayloadCMS remains the source of truth for media metadata (filename, sizes, alt text, ownership), while the storage backend determines where the bytes live.

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
- `src/plugins/index.ts` (look for the S3 storage adapter configuration and the `useCloudStorage` flag)

### When S3 is active

S3 storage is intended for production, and can be optionally enabled in development.

- In production (`NODE_ENV=production`), cloud storage is enabled.
- In development, cloud storage is enabled only when explicitly opted in.
- In tests/CI, cloud storage should remain off so tests do not require external credentials or network access.

This prevents integration tests from accidentally attempting real uploads to S3 and keeps test runs deterministic.

### Environment variables (what they mean)

When using S3-compatible storage, the app needs credentials and connection details:

- `S3_ENDPOINT`: The S3 API endpoint URL (often provider-specific).
- `S3_ACCESS_KEY_ID`: Access key id used by the S3 client.
- `S3_SECRET_ACCESS_KEY`: Secret access key used by the S3 client.
- `S3_BUCKET`: The bucket name where uploads are stored.
- `S3_REGION`: The bucket region used by the S3 client.
- `USE_S3_IN_DEV`: Development opt-in flag. When set to `true`, enables S3 in development.

If any of these are missing while S3 is enabled, uploads will fail.

### What the storage plugin changes

When the S3 adapter is active for a collection, local disk storage is disabled for that collection, and files are stored in S3 instead. This matters in production deployments where local filesystem storage is ephemeral or not shared between app instances.

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

### 4) Local storage: pick a predictable directory

Each upload collection specifies where files live locally (development). Keep this deterministic and grouped by collection (for example under `public/<collection>-media/`) so:

- developers can inspect files locally,
- and local URLs remain predictable.

### 5) S3 storage: register the collection in the storage adapter

If the collection stores files, it must be included in the S3 adapter configuration in `src/plugins/index.ts`.

What you decide there:

- the **prefix/namespace** in the bucket (should match the repo’s naming conventions),
- whether local storage is disabled when S3 is enabled (the adapter enforces this when active).

If you skip this step, production deployments may behave inconsistently (for example, trying to use local disk in environments where it is not durable).

### 6) Validate in three practical scenarios

Before merging, confirm:

- local development uploads work with local storage,
- a cloud-enabled environment stores new uploads in S3,
- test runs do not require S3 credentials and do not attempt network uploads.

## Quick Configuration Guide

### Local Storage (Development)

Local storage is the default. If you do nothing, uploads will be stored locally using the collection’s configured static directory.

### S3-Compatible Storage (Production or Development)

To use S3-compatible storage:

- Enable it by environment (production is enabled automatically; development requires explicit opt-in).
- Provide the S3 environment variables listed above.

If you are new to this repo, start with local storage to confirm uploads work end-to-end, then enable S3 once credentials are available.
