# Private AuthAction lifecycle

`authActions` stores system-managed authentication lifecycle data for [Website #1974](https://github.com/findmydoc-platform/website/issues/1974). `bindAuthActions` in `src/auth/actions/lifecycle.ts` is its internal command boundary. It creates pending actions, binds a principal once, reads raw system state, advances the lifecycle and sweeps expiry/retention. No product flow calls it yet. It sends no email, generates no Supabase credentials and consumes no callbacks.

## Identity and fixed policy

Payload's immutable positive numeric ID is the authoritative `authActionId` consumed by the existing transactional-email command normalizer, which produces `v1|auth-action|<id>`. There is no secondary ID or mapping. Each action stores a closed environment value, `local`, `test`, `ci`, `preview` or `production`. The trusted caller binds that environment once per service; reads and sweeps cannot cross it. Public request input does not select it.

| Action type | Principal collection | Supabase token type | Lifetime | Completion route | Final destination |
| --- | --- | --- | --- | --- | --- |
| `patient-verification` | `patients` | `magiclink` | 24 hours | `/patient/inquiries` | `patient-inquiries` |
| `clinic-invitation` | `clinicStaff` | `invite` | 24 hours | `/auth/invite/complete` | `clinic-dashboard` |
| `patient-recovery` | `patients` | `recovery` | 60 minutes | `/auth/password/reset/complete` | `patient-inquiries` |
| `clinic-recovery` | `clinicStaff` | `recovery` | 60 minutes | `/auth/password/reset/complete` | `clinic-dashboard` |
| `platform-recovery` | `platformStaff` | `recovery` | 60 minutes | `/auth/password/reset/complete` | `platform-administration` |

`callbackDestination` is the closed identifier `website-auth-callback`. It identifies the Website-owned `/auth/callback` on the action's deployment environment. The final destinations identify the approved patient inquiries page, Clinic Dashboard and platform Admin. A future callback/link adapter must resolve these identifiers against its trusted environment configuration. This collection accepts neither callback origins nor arbitrary redirect URLs.

The principal relationship contains only the authoritative collection and positive numeric Payload ID. Create and bind commands verify its existence with Payload Local API. Only pending patient verification can lack a principal. Once bound it is immutable, and progress to `active` requires it. Targets, action type, environment, expiry and creation time are immutable.

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

Public callers, patients and clinic staff cannot read the collection. Generic create, update and delete access is denied for every role, including platform staff. Platform staff can read only `id`, `actionType`, `environment`, `state`, `createdAt`, `updatedAt`, `expiresAt`, `terminalAt` and `outcomeCode`. Principal, token type and destination fields are excluded by field access and a final output whitelist, including Local API reads with `overrideAccess`. Admin fields are read-only, but collection hooks enforce the boundary independently of the UI.

System commands use a process-local opaque identity, bound to a fresh transaction, environment, target ID and exact write. JSON context flags cannot forge it. The identity expires before commit or rollback. Hooks deny generic Local API mutations even with `overrideAccess: true`. The service never exposes its request or capability to a caller callback.

The schema and strict commands exclude plaintext email, name, clinic content, passwords, tokens, token hashes, action links, rendered content, provider payloads, delivery state and retry state. Runtime exceptions are propagated to the trusted server caller, so future HTTP adapters must map them to safe response errors and must not serialize database details.

## Retention and concurrency

`sweep()` expires due nonterminal actions and hard-deletes terminal records once `terminalAt + 42 days` is reached. It processes at most 100 records per invocation in ID order. No Trash, retained content or deletion receipt is created. A repeated sweep returns committed counts and cannot extend retention. The callable sweep is ready for the platform's existing execution owner; this ticket does not activate a hosted scheduler.

Every system read and write, including the retention selection and final delete check, runs inside a fresh owned Serializable transaction. Borrowed transactions are rejected. Only SQLSTATE `40001` and `40P01`, including nested causes, repeat the entire command with fresh reads and hook validation, at most three attempts. There are no external effects in retry work. Commit errors propagate; rollback errors propagate together with the original failure. The existing Drizzle commit-error patch is required. [ADR 033](../adrs/033-adr-auth-actions-owned-transactions.md) records the human-approved exception; [the concurrency research](../research/issue-1974-auth-action-concurrency.md) provides its evidence and rejected alternatives.

Cache impact is `no-public-impact`. The catalog classifies this collection as `private-live`, owned by `auth-owner`, with no public cache tags, routes or invalidation hooks.

The additive Payload-generated migration creates only AuthAction storage and native principal relationship storage. Both the prior and next application can run after it; rollback the application while retaining these unused tables. Unit tests cover command/hook boundaries and failure handling. The collection registry assigns its real Local API lifecycle, privacy and coordinated concurrency contract to `tests/integration/authActions.lifecycle.test.ts`. Integration and E2E execution remains CI-only for this change.
