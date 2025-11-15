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
4. Internal lookup by Supabase user id; create if absent (user first, profile follows via hook for staff users).
5. Approval gate (clinic staff only) determines admin UI access; patients & platform staff are immediate.
6. Downstream access control functions rely on resolved user type & related profile linkage.

## Data Model Intent
Staff users deliberately separated into an auth record (`basicUsers`) and a role/profile record (`platformStaff` / `clinicStaff`) so operational attributes (status, role escalation, approval) evolve independently of identity. Patients remain single‑record for simplicity and performance.

## Provisioning Model
Staff and invite-only flows (`basicUsers` + profiles) continue to provision via collection lifecycle hooks. Hooks guarantee:
* Consistent creation (aborts on Supabase failure)
* Profile auto-creation (staff)
* Cascading cleanup (profile then Supabase account) on deletion

Patients now use a two-phase flow:
1. Frontend calls Supabase signup directly to create credentials and returns the `supabaseUserId`.
2. The client calls the `POST /api/auth/register/patient` endpoint, which updates Supabase metadata and creates the Payload `patients` record.

This keeps patient self-serve signup explicit (no hooks) while preserving Payload as the source of truth for medical/profile data.

## Access Control Principles
* Authorization is collection‑driven (Payload access functions) – never on the client.
* Clinic staff must be both authentic and approved for admin UI; unapproved users remain valid identities but are limited in scope.
* Patients use stateless auth (no server session) to reduce server state.

## Error & Integrity Guarantees
* Partial failures in provisioning fail fast for Supabase identity creation; profile creation occurs shortly after user creation via hook (not transactional).
* Deletion is best‑effort for external identity: internal data removal proceeds even if external cleanup fails (logged for ops).
* (Planned) Profile recovery: automatic profile recreation for historical staff users without a profile may be added later.

## Security & Compliance Highlights
* Token mandatory: no implicit fallback or anonymous escalation.
* Strict separation of identity (Supabase) & authorization (Payload collections) simplifies auditing.
* Approval status gives a reversible control point without altering Supabase accounts.
* Registration endpoints return generic error messages to avoid leaking whether an email already exists; Supabase email-confirmation requirements are enforced upstream by Supabase itself.

## Operational Insights
Current monitoring: basic log statements (info/warn/error) for provisioning and approval checks. Advanced metrics (approval latency, profile recovery counts) are deferred.

## Extensibility Guidelines
When adding a new user category:
1. Decide: single record vs. record + profile.
2. Add collection(s) with minimal required fields & access rules.
3. Reuse existing hook patterns for provisioning & cleanup.
4. Extend approval logic only if workflow truly differs from existing types.

Avoid embedding business logic in frontend components; always prefer server hooks for validation & side‑effects.

## Reference Map (Folders)
* `src/auth/strategies/` – Strategy & diagram (conceptual contract).
* `src/hooks/userLifecycle/` – Provisioning & cleanup hooks (single source of identity linkage logic).
* `src/collections/` – User & profile collections (authorization boundary definitions).

For interaction timing or detailed branching, consult the maintained sequence diagram rather than source code.
