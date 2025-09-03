# Supabase Provisioning (High‑Level)

This document summarizes what the platform’s provisioning layer accomplishes for identities; it deliberately omits code specifics already covered by the sequence diagram (`auth-flow-diagram.md`).

## Purpose
Guarantee that every persisted platform user (staff or patient) has a corresponding Supabase identity and that related role/profile data stays consistent over time without manual intervention.

## Design Tenets
* Single Flow: All creation & deletion side‑effects run through collection lifecycle hooks – no parallel “manual” pathway.
* Two-Phase Creation (Staff): User auth record is created first; profile creation follows via lifecycle hook (non-transactional).
* Idempotent Lookup: Re‑creating existing external identities is avoided; existing Supabase user ids short‑circuit provisioning.
* Fail Fast on Create, Lenient on Delete: Inbound creation stops on external failure; deletion proceeds even if external cleanup fails (logged for follow‑up).
* Stateless Auth Consumption: The platform never stores Supabase credentials; it stores only the linking identifier.

## Scope by User Category
| Category | Internal Records | External Link | Extra Workflow |
|----------|------------------|---------------|----------------|
| Platform Staff | basic user + platform profile | Supabase user id | Immediate access |
| Clinic Staff | basic user + clinic profile | Supabase user id | Requires approval checkpoint |
| Patient | single patient record | Supabase user id | None |

## Provisioning Lifecycle
1. Initiate create (admin UI or API) with minimal required fields (email, user type, and password supplied upstream).
2. Hook ensures an external Supabase identity exists (creates if absent) and stores its id.
3. Staff: role profile is instantiated (or repaired if historically missing) after identity confirmation.
4. Deletion runs in reverse order (profile → auth record → external identity) to avoid foreign key & orphan issues.

## Integrity Safeguards
* Profile drift possible until recovery mechanism is implemented; current safeguard halts on Supabase identity failure only.
* No orphan identities on partial create: Failure to establish external identity halts persistence (user not stored).
* External deletion best‑effort: Internal data correctness prioritized; operational logs surface external cleanup failures.

## Operational Signals (Monitor)
* Provisioning failure count (create aborts)
* External deletion failure count
* Auto‑recovered profile events
* Clinic approval latency (identity created → approval granted)

## Extension Guidelines
When introducing another user category:
1. Decide between single vs. dual record (auth + profile) based on role complexity.
2. Reuse existing hook pattern; do not introduce ad‑hoc provisioning endpoints.
3. Emit structured logs for create/delete to feed monitoring dashboards.
4. Add approval or gating only if materially distinct from existing clinic workflow.

## Folder Reference
* `src/hooks/userLifecycle/` – All provisioning & cleanup logic (source of truth).
* `src/auth/utilities/` – Shared utilities for external identity orchestration.
* `src/collections/` – User & profile schema definitions (authorization boundaries).

Consult the auth flow diagram for step‑by‑step interaction ordering; this page focuses on intent and guarantees.
