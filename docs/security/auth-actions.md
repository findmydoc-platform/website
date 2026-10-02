# Private AuthAction lifecycle

`authActions` stores system-managed authentication lifecycle data. `bindAuthActions` in `src/auth/actions/lifecycle.ts` is its internal command boundary. It creates pending actions, binds identity and principal once, reads raw system state, advances the lifecycle and sweeps expiry/retention. No product flow calls it yet. It sends no email, generates no Supabase credentials and consumes no callbacks.

## Identity and fixed policy

Payload's immutable positive numeric ID is the authoritative `authActionId` consumed by the existing transactional-email command normalizer, which produces `v1|auth-action|<id>`. There is no secondary ID or mapping. Each action stores a closed environment value, `local`, `test`, `ci`, `preview` or `production`. The trusted caller binds that environment once per service; reads and sweeps cannot cross it. Public request input does not select it.

| Action type | Principal collection | Supabase token type | Lifetime | Completion route | Final destination |
| --- | --- | --- | --- | --- | --- |
| `patient-verification` | `patients` | `magiclink` | 24 hours | `/patient/inquiries` | `patient-inquiries` |
| `clinic-invitation` | `clinicStaff` | `invite` | 24 hours | `/auth/invite/complete` | `clinic-dashboard` |
| `patient-recovery` | `patients` | `recovery` | 60 minutes | `/auth/password/reset/complete` | `patient-inquiries` |
| `clinic-recovery` | `clinicStaff` | `recovery` | 60 minutes | `/auth/password/reset/complete` | `clinic-dashboard` |
| `platform-recovery` | `platformStaff` | `recovery` | 60 minutes | `/auth/password/reset/complete` | `platform-administration` |

`callbackDestination` is derived from the action type. Patient verification, patient recovery and platform recovery use `website-auth-callback`. Clinic invitation and clinic recovery use `clinic-dashboard-auth-callback`. Both identify `/auth/callback` on the owning application's deployment environment. The Website still owns lifecycle transitions for Dashboard flows; Dashboard callback routes use the authenticated Website protocol. A callback/link adapter resolves these identifiers against trusted environment configuration. This collection accepts neither callback origins nor arbitrary redirect URLs.

The principal relationship contains only the authoritative collection and positive numeric Payload ID. Create and bind commands verify its existence with Payload Local API. Only patient verification may be created without a principal. A private immutable `principalBoundAt` timestamp records the first binding, preventing replacement even if native principal deletion later removes the relationship. Expiry, cancellation and terminal retention still work after principal deletion. Targets, action type, environment, expiry and creation time are immutable.

Patient verification separates identity creation from patient provisioning. The trusted Auth caller uses `bindSubject` after reconciling the Supabase identity. It binds the UUID once to a pending, unexpired action with no prior principal binding. `supabaseSubject` and `subjectBoundAt` are private and absent from platform diagnostics. This binding permits `active` and `confirmed` before a patient record exists. It does not confirm the Supabase token itself; the callback owner must verify that token and its subject before requesting confirmation.

After confirmation, `bindPrincipal` attaches the provisioned patient only when its current `supabaseUserId` matches the bound subject. Completion requires that patient to remain available with the same subject. Removing the relationship cannot reopen the pre-provisioning path because `principalBoundAt` remains set. Repeating the same subject binding is idempotent and preserves its timestamp; a different subject cannot replace it. The existing principal-first lifecycle remains supported for actions created with a principal and no separate subject binding. Clinic and recovery flows always require their existing authoritative principal.

## Transitions and repeats

| Persisted state | Allowed next states |
| --- | --- |
| `pending` | `active`, `superseded`, `expired`, `revoked` |
| `active` | `confirmed`, `superseded`, `expired`, `revoked` |
| `confirmed` | `completed`, `expired`, `revoked` |
| `completed`, `superseded`, `expired`, `revoked` | none |

`expired` requires the expiry time to have arrived. Progress to `active`, `confirmed` or `completed` requires an unexpired action. Same-state commands return the existing record without a write when the outcome agrees, including terminal retries. Rebinding the same principal also returns the record without a write. Rebinding a different principal, changing a terminal outcome, skipping a transition or reopening a terminal action fails. Creation is a new action each time; deduplication by a plaintext recipient is deliberately absent.

The first terminal transition assigns `terminalAt`. It is immutable. The only outcome field is `outcomeCode`. `superseded` has outcome `superseded`; `revoked` permits no outcome or `ineligible`, `source-unavailable`, `recipient-changed`. All other states have no outcome. Free text and arbitrary metadata are rejected.

## Access and data minimization

Public callers, patients and clinic staff cannot read the collection. Generic create, update and delete access is denied for every role, including platform staff. Platform staff can read only `id`, `actionType`, `environment`, `state`, `createdAt`, `updatedAt`, `expiresAt`, `terminalAt` and `outcomeCode`. Principal, Supabase subject, binding timestamps, token type and destination fields are excluded by field access and a final output whitelist, including Local API reads with `overrideAccess`. Admin fields are read-only, but collection hooks enforce the boundary independently of the UI.

System commands use a process-local opaque identity, bound to a fresh transaction, environment, target ID and exact write. JSON context flags cannot forge it. The identity expires before commit or rollback. Hooks deny generic Local API mutations even with `overrideAccess: true`. The service never exposes its request or capability to a caller callback.

The schema and strict commands exclude plaintext email, name, clinic content, passwords, tokens, token hashes, action links, rendered content, provider payloads, delivery state and retry state. Runtime exceptions are propagated to the trusted server caller, so future HTTP adapters must map them to safe response errors and must not serialize database details.

## Retention and concurrency

`sweep()` expires due nonterminal actions and hard-deletes terminal records once `terminalAt + 42 days` is reached. It processes at most 100 records per invocation in ID order. No Trash, retained content or deletion receipt is created. A repeated sweep returns committed counts and cannot extend retention. The callable sweep is ready for the platform's existing execution owner; this ticket does not activate a hosted scheduler.

Every system read and write, including the retention selection and final delete check, runs inside a fresh owned Serializable transaction. Borrowed transactions are rejected. Only SQLSTATE `40001` and `40P01`, including nested causes, repeat the entire command with fresh reads and hook validation, at most three attempts. There are no external effects in retry work. Commit errors propagate; rollback errors propagate together with the original failure and stop retries. The repository's Drizzle transaction-error patch preserves commit and rollback failures. [ADR 033](../adrs/033-adr-auth-actions-owned-transactions.md) records the human-approved exception; [the concurrency research](../research/issue-1974-auth-action-concurrency.md) provides its evidence and rejected alternatives.

Cache impact is `no-public-impact`. The catalog classifies this collection as `private-live`, owned by `auth-owner`, with no public cache tags, routes or invalidation hooks.

The additive Payload-generated migrations create AuthAction storage and native principal relationship storage, then add the nullable binding timestamp. The product-binding migration adds nullable subject fields and the Dashboard callback enum value. Keep the expanded schema during an application rollback; its generated down migration drops identity bindings and cannot retain Dashboard callback values. New Dashboard actions are not writable through the prior application's Website-only policy. Unit tests cover command/hook boundaries and owner failure handling against the installed transaction controls without a database. The collection registry assigns its real Local API lifecycle, principal deletion, privacy and coordinated concurrency contract to `tests/integration/authActions.lifecycle.test.ts`. Integration and E2E execution remains CI-only for this change.
