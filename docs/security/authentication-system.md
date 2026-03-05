# Authentication System (High‑Level Overview)

This document explains what the authentication & user lifecycle does – not how individual functions are written. For the end‑to‑end interaction details, see the sequence diagram in `auth-flow-diagram.md`.

## Core Purpose
Unify external identity (Supabase Auth) with internal authorization (PayloadCMS collections) through a stateless flow. Every authenticated request presents a Supabase JWT; the platform ensures a matching internal user entity and (for staff) an associated profile.

## Actors & Domains
| Actor | Responsibility | Internal Representation |
|-------|----------------|-------------------------|
| Platform Staff | Operate administrative UI & manage data | `basicUsers` + `platformStaff` profile |
| Clinic Staff | Manage clinic content after approval       | `basicUsers` + `clinicStaff` profile   |
| Patient | Consume public / patient features               | `patients` (single record)            |

## Lifecycle Summary
1. User authenticates against Supabase → receives JWT.
2. Request arrives with `Authorization: Bearer <token>`.
3. Strategy validates token & extracts metadata (email, user type, ids).
4. Internal lookup first by Supabase user id, then (if needed) by normalized email to reconcile historical records and synchronize missing/old Supabase ids.
5. If no internal entity is found, strategy-level provisioning creates the internal record (user first, profile follows via hook for staff users).
6. Approval gate (clinic staff only) determines admin UI access; patients & platform staff are immediate.
7. Downstream access control functions rely on resolved user type & related profile linkage.

## Data Model Intent
Staff users deliberately separated into an auth record (`basicUsers`) and a role/profile record (`platformStaff` / `clinicStaff`) so operational attributes (status, role escalation, approval) evolve independently of identity. Patients remain single‑record for simplicity and performance.

## Provisioning Model
Staff and invite-only flows (`basicUsers` + profiles) continue to provision via collection lifecycle hooks. Hooks guarantee:
* Consistent creation (aborts on Supabase failure)
* Profile auto-creation (staff)
* Cascading cleanup (profile then Supabase account) on deletion

Patients now use a confirm-before-login flow:
1. The frontend calls Supabase signup directly. With email confirmation enabled, Supabase returns a user but no session; the UI simply instructs the patient to confirm their email.
2. After the patient clicks the confirmation link and logs in for the first time, the Supabase JWT strategy detects the authenticated patient and idempotently creates the Payload `patients` record (and any related data) using Supabase metadata.

Admin login page behavior:
* The `/admin/login` route performs read-only status checks and redirects.
* It does not create users directly, which prevents page-level write side-effects and redirect loops when provisioning fails.

## Access Control Principles
* Authorization is collection‑driven (Payload access functions) – never on the client.
* Clinic staff must be both authentic and approved for admin UI; unapproved users remain valid identities but are limited in scope.
* Patients use stateless auth (no server session) to reduce server state.

## Error & Integrity Guarantees
* Partial failures in provisioning fail fast for Supabase identity creation; profile creation occurs shortly after user creation via hook (not transactional).
* Deletion is best‑effort for external identity: internal data removal proceeds even if external cleanup fails (logged for ops).
* Provisioning/classification errors use typed auth error codes (for example invalid email, create conflict, lookup failure) to support deterministic handling and monitoring.
* Concurrent create conflicts are recovered by immediate re-lookup before denying access.
* (Planned) Profile recovery: automatic profile recreation for historical staff users without a profile may be added later.

## Security & Compliance Highlights
* Token mandatory: no implicit fallback or anonymous escalation.
* Strict separation of identity (Supabase) & authorization (Payload collections) simplifies auditing.
* Approval status gives a reversible control point without altering Supabase accounts.
* Registration endpoints return generic error messages to avoid leaking whether an email already exists; Supabase email-confirmation requirements are enforced upstream by Supabase itself.

## Operational Insights
Current monitoring uses structured log events (info/warn/error) for provisioning, reconciliation, approval checks, and auth error classification. Advanced metrics (approval latency, profile recovery counts) are deferred.

## Extensibility Guidelines
When adding a new user category:
1. Decide: single record vs. record + profile.
2. Add collection(s) with minimal required fields & access rules.
3. Reuse existing hook patterns for provisioning & cleanup.
4. Extend approval logic only if workflow truly differs from existing types.

Avoid embedding business logic in frontend components; always prefer server hooks for validation & side‑effects.

## Reference Map (Folders)
* `src/auth/strategies/` – Strategy & diagram (conceptual contract).
* `src/collections/BasicUsers/hooks/` – Staff provisioning hooks (for example Supabase identity creation).
* `src/collections/Patients/hooks/` – Patient provisioning/cleanup hooks.
* `src/collections/` – User & profile collections (authorization boundary definitions).

For interaction timing or detailed branching, consult the maintained sequence diagram rather than source code.
