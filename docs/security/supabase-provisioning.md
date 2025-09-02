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
- Skips only if `data.supabaseUserId` already exists (e.g. created via auth strategy).
- Password: UI / caller is expected to provide one. If absent, upstream validation (form, API route, Supabase) should fail; the hook does not attempt to enforce strong password rules.
- Optional metadata from `req.context.userMetadata`.
- Calls `createSupabaseAccount(...)`, writes `supabaseUserId` back.
- If a temporary password was generated upstream, it can be stored in a transient field (implementation detail) for one‑time delivery; hook itself does not generate or store temps.
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
- Skips only if `data.supabaseUserId` already exists.
- Password handling: the hook forwards whatever `data.password` (or contextual password) was supplied; it does NOT validate or require a password itself. Validation / requirement is delegated to:
  - UI form constraints
  - Collection field validation
  - Supabase admin API (will error if password is truly required for that flow)
- Optional metadata from `req.context.userMetadata`.
- Calls `createSupabaseAccount({ userType: 'patient', ... })`, writes `supabaseUserId` back.
- On error, throws to abort Patient creation (patients must have auth accounts). If password is missing and Supabase rejects, the error propagates here.

## Patients — delete flow
When: `beforeDelete`
- Loads the Patient to read `supabaseUserId`.
- Calls `deleteSupabaseAccount`. Logs but never blocks deletion.

## Passing context to hooks
You can pass context via `payload.create({ collection, data, context: { ... } })` (and in route/server actions that call it):
- `userProvidedPassword: string` — explicit password to use (patients: required; staff: optional).
- `userMetadata: { firstName?: string; lastName?: string }` — optional metadata.

> Note: A former `skipSupabaseCreation` flag was removed to ensure every created user has an auth identity. Tests achieve isolation by mocking `createSupabaseAccount` instead of skipping provisioning.

## Edge cases
- Duplicate email on create: Supabase errors; hooks bubble it up and creation is aborted.
- Delete when Supabase user is missing: delete helper returns `false`; hooks log and proceed.
- Temporary passwords (staff only): ensure the `temporaryPassword` field is admin-only and consider clearing it after first view/use.

## Minimal contract
- Inputs on create: `email` (required), `password` (expected upstream; hooks pass through; absence will surface as Supabase error), `userType` (staff from BasicUser, patient fixed), `userMetadata?`.
- Output: `supabaseUserId` on the created document.
- Success: document created and linked to Supabase user; on failure, creation aborted with clear error.
- Delete: best-effort cleanup; never blocks Payload deletion.

## Rationale: no in-hook password validation
Centralizing password policy in the UI + collection validation + Supabase keeps hooks minimal and reduces duplicated logic. Hooks focus solely on provisioning linkage. Any stricter policy changes can be made in one place (form/schema) without touching lifecycle logic.
