# Private AuthAction lifecycle

`authActions` stores system-managed authentication lifecycle data. `bindAuthActions` in `src/auth/actions/lifecycle.ts` is its internal command boundary. It creates or reserves pending actions, binds identity and principal once, reads raw system state, advances the lifecycle and sweeps expiry/retention. `bindPendingPatientVerification` prepares an unconfirmed Supabase identity for a reserved action. No public product route calls these commands yet. They send no email, generate no authentication links and consume no callbacks.

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

## Pending patient verification correlation

`reservePatientVerification` validates and normalizes the email using the Auth domain's existing normalization rules. It preserves plus tags and dots. HMAC-SHA-256 covers the JSON array `["auth-action-correlation-v1", environment, "patient-verification", normalizedEmail]`. Only the lowercase hexadecimal digest and non-secret key version are persisted as private `correlationDigest` and `correlationKeyVersion`. The input email and password are never written to an AuthAction or logged by the preparation service.

The trusted Auth caller supplies a dedicated key ring for its deployment environment, current key first. Preview and Production require separate secret material. Keys are server-side configuration, never browser input or delivery-platform keys. Keep every previous key until all of its stored correlation fields have been swept after their 24-hour window. If the environment contains a stored correlation version absent from the supplied ring, reservation fails closed. Rotation therefore cannot silently bypass deduplication or limits.

A technical retry returns the same nonterminal action across all supplied key versions. It does not create a new action or count against resend limits. The trusted caller authorizes a resend before supplying `resendOf`, which must identify the current pending or active action for that address. Confirmed actions cannot be superseded. Each new action requires a five-minute interval from the last creation and fewer than five creations in the preceding 24 hours. Supersession and replacement run in one owned Serializable transaction. Expired predecessors are terminalized before replacement. The email-to-action lookup stays within the Auth domain and is absent from platform diagnostics.

`bindPendingPatientVerification.prepare` commits the reservation before calling Supabase's server-only [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) API with `email_confirm: false` and authoritative patient app metadata. A missing or failed creation response is reconciled with the paginated [listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers) API. Exactly one matching unconfirmed patient identity is eligible. Confirmed identities, other principal types, mismatched addresses and ambiguous matches are rejected. Existing passwords are never replaced during reconciliation. Provider errors are mapped to `identity-unavailable` without retaining their content. The subject is then bound to the same reserved action. If the process stops before binding, a retry resumes the reservation and reconciles the identity again. Supabase calls are outside all automatically retried database transactions.

The retention sweep removes both correlation fields at `createdAt + 24 hours`, including completed actions whose patient relationship has been deleted, while retaining the established lifecycle metadata. This narrowly scoped deletion does not change the subject, binding timestamps, state or original terminal timestamp. It expires due live actions and deletes terminal history at the existing 42-day boundary. Deployment activation and the hosted sweep schedule are separate from this internal preparation boundary.

## Recovery request admission

`reserveRecovery` accepts a normalized email and an opaque client context. It counts admitted requests before checking account eligibility. Target and IP each allow at most five admissions in the preceding rolling hour and require five minutes since their last admission. A denial writes neither dimension and does not extend either cooldown. Unknown, ambiguous or ineligible addresses consume an admitted allowance but create no AuthAction or delivery command.

The resolver reads current `patients`, `clinicStaff` and `platformStaff` records in the owned transaction. Exactly one principal with a valid Supabase UUID is required. Clinic staff additionally require `pending` or `approved` status and successful `authSync`. These authentication rules do not grant clinic business access. Eligible requests create the matching pending recovery AuthAction bound to the authoritative principal in the same transaction as both counters. No Supabase call or delivery effect runs in automatically retried work. [ADR 033](../adrs/033-adr-auth-actions-owned-transactions.md) bounds the transaction-control exception.

`bindRecoveryRequests.request` returns HTTP 200 with `{ "ok": true }` and `Cache-Control: no-store` for every syntactically valid address, including limits, missing trusted IP and infrastructure failures. Invalid address syntax returns 400 without an admission. It never serializes the internal action or exception. This is an internal response adapter; existing public reset routes and native send calls remain unchanged until their delivery-flow replacement. It does not promise identical processing times.

`websiteRecoveryContext` accepts only `x-vercel-forwarded-for` while running on Vercel in Preview or Production. Arbitrary forwarded headers, IP chains and local fallback input are rejected. [Vercel's request header contract](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for) supplies that deployment boundary. IPv6 spelling and IPv4-mapped IPv6 normalize to one counter identity.

`dashboardRecoveryContext` is the authentication primitive for the Dashboard `requestRecovery` adapter, not a published endpoint. It verifies HMAC-SHA-256 over the UTF-8 JSON array `["auth-recovery-request-v1", environment, method, operation, timestamp, requestId, sha256(rawBody)]`. The method is `POST`, the operation is `requestRecovery`, and `requestId` is a UUID. The timestamp is not in the future and is less than five minutes old. The strictly parsed signed body contains only `email` and `clientIP`. Its email and environment must still match at admission, and the context expires at the end of the signed window. A replay cannot outlive the five-minute cooldown. The complete protocol's request-ID idempotency and remaining operations belong to its Website/Dashboard integration. JSON flags or serialized context objects grant no authority.

Recovery counting and Dashboard authentication use separate server-side key rings, each with distinct Preview and Production secret material. Current counting key comes first; keep previous versions until their events expire. HMAC counting covers `["auth-recovery-correlation-v1", environment, dimension, normalizedValue]`. Missing live versions fail closed instead of resetting limits. A `recoveryRequestEvents` row contains only `environment`, one `dimension`, `keyVersion`, `digest`, `observedAt` and Payload's ID. It has no principal, action, request-ID or opposite-dimension relationship. HMACs are pseudonyms, not anonymization; privileged database access can still correlate timestamps. No plaintext email, IP or digest enters Auth logs or responses.

Generic operations and Admin access are denied to every role. Hooks enforce an opaque owned request even with Local API `overrideAccess`. Rows are immutable and unavailable in platform diagnostics. The additive Payload-generated migration creates the table and indexes; its security adjustment enables RLS with no public policy, denying ordinary Supabase Data API roles. Payload's trusted database owner remains responsible for domain access. Keep the new table during application rollback; its generated down migration destroys counters and is not an application rollback step.

`sweepRecovery()` deletes up to 100 events at `observedAt + one hour` through the same owned boundary. The existing one-minute Website scheduler drains these batches before mail work, independently of mail feature flags. Cleanup has a 30-second budget within the existing invocation deadline. A cleanup failure does not stop independent mail work, which still uses the remaining invocation budget. The route returns a safe 503 if either task fails. No new queue, cron, worker or deletion receipt is introduced. With a functioning schedule that runs at least every five minutes and enough processing capacity, events are removed within 65 minutes; the configured one-minute cadence leaves additional margin. An interrupted schedule or sustained backlog violates that retention target and needs operational recovery; a successful unit test does not establish the hosted guarantee.

Cache impact is `no-public-impact`: private live reads only, no tags, public routes, lists, discovery dependencies or invalidation. Permission-matrix tests cover all roles. Focused unit tests cover admission, rotation, eligibility, trusted contexts, neutral responses, rollback and deletion. The collection contract registry assigns real transaction races and privacy/deletion checks to `tests/integration/recoveryRequests.lifecycle.test.ts`, executed in CI only.

## Transitions and repeats

| Persisted state | Allowed next states |
| --- | --- |
| `pending` | `active`, `superseded`, `expired`, `revoked` |
| `active` | `confirmed`, `superseded`, `expired`, `revoked` |
| `confirmed` | `completed`, `expired`, `revoked` |
| `completed`, `superseded`, `expired`, `revoked` | none |

`expired` requires the expiry time to have arrived. Progress to `active`, `confirmed` or `completed` requires an unexpired action. Same-state commands return the existing record without a write when the outcome agrees, including terminal retries. Rebinding the same principal also returns the record without a write. Rebinding a different principal, changing a terminal outcome, skipping a transition or reopening a terminal action fails. The generic create command creates a new action. Patient registration preparation uses the private correlation reservation instead.

The first terminal transition assigns `terminalAt`. It is immutable. The only outcome field is `outcomeCode`. `superseded` has outcome `superseded`; `revoked` permits no outcome or `ineligible`, `source-unavailable`, `recipient-changed`. All other states have no outcome. Free text and arbitrary metadata are rejected.

## Access and data minimization

Public callers, patients and clinic staff cannot read the collection. Generic create, update and delete access is denied for every role, including platform staff. Platform staff can read only `id`, `actionType`, `environment`, `state`, `createdAt`, `updatedAt`, `expiresAt`, `terminalAt` and `outcomeCode`. Principal, Supabase subject, binding timestamps, token type and destination fields are excluded by field access and a final output whitelist, including Local API reads with `overrideAccess`. Admin fields are read-only, but collection hooks enforce the boundary independently of the UI.

System commands use a process-local opaque identity, bound to a fresh transaction, environment, target ID and exact write. JSON context flags cannot forge it. The identity expires before commit or rollback. Hooks deny generic Local API mutations even with `overrideAccess: true`. The service never exposes its request or capability to a caller callback.

The schema and strict commands exclude plaintext email, name, clinic content, passwords, tokens, token hashes, action links, rendered content, provider payloads, delivery state and retry state. Runtime exceptions are propagated to the trusted server caller, so future HTTP adapters must map them to safe response errors and must not serialize database details.

## Retention and concurrency

`sweep()` expires due nonterminal actions and hard-deletes terminal records once `terminalAt + 42 days` is reached. It processes at most 100 records per invocation in ID order. No Trash, retained content or deletion receipt is created. A repeated sweep returns committed counts and cannot extend retention. The callable sweep is ready for the platform's existing execution owner; this ticket does not activate a hosted scheduler.

Every system read and write, including the retention selection and final delete check, runs inside a fresh owned Serializable transaction. Borrowed transactions are rejected. Only SQLSTATE `40001` and `40P01`, including nested causes, repeat the entire command with fresh reads and hook validation, at most three attempts. There are no external effects in retry work. Commit errors propagate; rollback errors propagate together with the original failure and stop retries. The repository's Drizzle transaction-error patch preserves commit and rollback failures. [ADR 033](../adrs/033-adr-auth-actions-owned-transactions.md) records the human-approved exception; [the concurrency research](../research/issue-1974-auth-action-concurrency.md) provides its evidence and rejected alternatives.

Cache impact is `no-public-impact`. The catalog classifies this collection as `private-live`, owned by `auth-owner`, with no public cache tags, routes or invalidation hooks.

The additive Payload-generated migrations create AuthAction storage and native principal relationship storage, then add the nullable binding timestamp. The product-binding migration adds nullable subject fields and the Dashboard callback enum value; the correlation migration adds two nullable indexed text fields. Keep the expanded schema during an application rollback: generated down migrations drop stored bindings or correlation data and cannot retain Dashboard callback values. New Dashboard actions are not writable through the prior application's Website-only policy. Unit tests cover command/hook boundaries and owner failure handling against the installed transaction controls without a database. The collection registry assigns its real Local API lifecycle, principal deletion, privacy and coordinated concurrency contract to `tests/integration/authActions.lifecycle.test.ts`. Integration and E2E execution remains CI-only for this change.

## Durable clinic password evidence

`recordClinicInitialPasswordCompletion` is the internal Website completion boundary. It requires a completed
`clinic-invitation` bound to the exact current Supabase subject and principal, fresh server-verified password
authentication, synchronized staff identity, approved participation, and a non-rejected, non-deleted assigned clinic.
It retains private source, subject, clinic, evidence time, observation time, and a non-relational action ID on
`clinicStaff`. Terminal AuthAction deletion therefore cannot erase completion proof. Generic Local API access overrides
and editable Admin inputs cannot write or replace this evidence.

The current clinic AuthAction lifecycle does not yet bind a subject. #1986 must supply that immutable binding, and
#1995 must verify the actual password operation before completing the action and calling this boundary. No public
completion route calls it today. An action state, email outcome, or mock alone does not prove account completion.
The [clinic participation contract](clinic-participation.md) owns the legacy import and password-usability fallback.
