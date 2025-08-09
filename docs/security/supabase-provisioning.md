# Supabase provisioning: overview

This note explains how Supabase auth users are created/deleted via Payload hooks and the shared provisioning utility. It’s a quick reference for engineers working on staff (BasicUsers) and patients.

## Key files
- Utility: `src/auth/utilities/supabaseProvision.ts`
- Staff hooks: 
  - Create: `src/hooks/userLifecycle/basicUserSupabaseHook.ts`
  - Delete: `src/hooks/userLifecycle/basicUserDeletionHook.ts`
- Patient hooks:
  - Create + Delete: `src/hooks/userLifecycle/patientSupabaseHooks.ts`

## Utility: supabaseProvision.ts
- `createSupabaseAccount({ email, password, userType, userMetadata? }) => Promise<string>`
  - Creates a Supabase user via admin API; returns `supabaseUserId`.
  - Throws on failure (callers abort creation).
- `deleteSupabaseAccount(supabaseUserId) => Promise<boolean>`
  - Deletes via admin API; never throws.
  - Returns `true` on success, `false` on failure; callers log and continue.

## Staff (BasicUsers) — create flow
When: `beforeChange` (create only)
- Skips if `data.supabaseUserId` exists or `req.context.skipSupabaseCreation` is true.
- Password: uses `req.context.userProvidedPassword` if present, otherwise generates a temporary password.
- Optional metadata from `req.context.userMetadata`.
- Calls `createSupabaseAccount(...)`, writes `supabaseUserId` back.
- If a temporary password was generated, stores it in the document’s `temporaryPassword` and in `req.context.temporaryPassword` for downstream use.
- On error, throws to abort BasicUser creation (consistency over partial writes).

## Staff (BasicUsers) — delete flow
When: `beforeDelete`
- Loads the BasicUser to resolve `userType` and `supabaseUserId`.
- Deletes related profile records first to avoid FK issues:
  - `clinic` → `clinicStaff`
  - otherwise → `platformStaff`
- Attempts to delete the Supabase user. Logs but does not block deletion on failure.

## Patients — create flow
When: `beforeChange` (create only)
- Skips if `data.supabaseUserId` exists or `req.context.skipSupabaseCreation` is true.
- Requires `req.context.userProvidedPassword` (no temporary passwords for patients).
- Optional metadata from `req.context.userMetadata`.
- Calls `createSupabaseAccount({ userType: 'patient', ... })`, writes `supabaseUserId` back.
- On error, throws to abort Patient creation (patients must have auth accounts).

## Patients — delete flow
When: `beforeDelete`
- Loads the Patient to read `supabaseUserId`.
- Calls `deleteSupabaseAccount`. Logs but never blocks deletion.

## Passing context to hooks
You can pass context via `payload.create({ collection, data, context: { ... } })` (and in route/server actions that call it):
- `userProvidedPassword: string` — explicit password to use (patients: required; staff: optional).
- `userMetadata: { firstName?: string; lastName?: string }` — optional metadata.
- `skipSupabaseCreation: boolean` — create the document without provisioning (use sparingly for backfills).

## Edge cases
- Duplicate email on create: Supabase errors; hooks bubble it up and creation is aborted.
- Delete when Supabase user is missing: delete helper returns `false`; hooks log and proceed.
- Temporary passwords (staff only): ensure the `temporaryPassword` field is admin-only and consider clearing it after first view/use.

## Minimal contract
- Inputs on create: `email` (required), `password` (staff: generated if absent; patients: must be provided), `userType` (staff from BasicUser, patient fixed), `userMetadata?`.
- Output: `supabaseUserId` on the created document.
- Success: document created and linked to Supabase user; on failure, creation aborted with clear error.
- Delete: best-effort cleanup; never blocks Payload deletion.
