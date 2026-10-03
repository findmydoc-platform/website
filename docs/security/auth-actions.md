# Private AuthAction lifecycle

`authActions` stores system-managed authentication lifecycle data. `bindAuthActions` in `src/auth/actions/lifecycle.ts` is its internal command boundary. It creates or reserves pending actions, binds identity and principal once, reads raw system state, advances the lifecycle and sweeps expiry/retention. `bindPendingPatientVerification` prepares an unconfirmed Supabase identity for a reserved action. Patient registration calls the Auth request boundary, which activates the bound action and accepts its verification command. AuthActions store no rendered mail or authentication link. Callback consumption and final patient provisioning remain separate.

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

Public identity reconciliation reads at most two pages of 1,000 users. If the second page is full, the inventory is
incomplete and no identity is bound, even if a matching address was seen. Registration returns its neutral response,
leaves the reservation unbound and sends nothing. This resource limit prevents directory-size-dependent public work;
it is not an account-existence result. Larger inventories require a trusted targeted identity-reconciliation mechanism
before relying on uncertain creation recovery. Successfully created identities and already bound retries do not scan
the directory. No global Supabase identity list is cached or exposed.

## Patient verification delivery

`POST /api/auth/register/patient` validates the existing email, password and names and preserves Preview Guard.
It accepts no resend authority, recipient, action URL, template or provider setting. `requestPatientVerification`
prepares the identity without native mail, activates the same action and accepts only its `auth.email-verification`
command. Names become Supabase user metadata only when creating a new identity. Reconciliation does not replace
an existing password or profile. An authorized internal Auth resend uses `resendOf`. The email-only public adapter
resolves that authority inside Auth, as described below.
Confirmed identities and other account types return the same neutral registration response without a mail command.
Infrastructure or configuration failures return a generic 503. Logs contain a safe event and email hash, not passwords,
provider exceptions or raw recipient addresses.

`AUTH_VERIFICATION_CORRELATION_KEYS_JSON` supplies a strictly validated server-only object with `environment`
and `keys`, each containing `version` and `secret`. Its environment must match the deployment. Keys use the validation
and rotation rules above. Missing configuration fails closed. Catalog construction resolves the ring lazily so an
unused verification entry cannot disable unrelated clinic receipt mail. No secret value is committed or supplied by a
browser. Hosted verification remains disabled until its separate activation declaration and credentials are present.
The registration path then returns 503 before creating an identity; it never falls back to native Supabase sending.

The production catalog reads the current active action and its bound Supabase UUID before acceptance, preparation and
each attempt. It requires the same environment, 24-hour expiry, patient role, unconfirmed identity and original
email correlation. A changed address, missing identity, ban, confirmation or lost action eligibility suppresses the
operation rather than redirecting it. Supabase `generateLink` generates only a `magiclink`; its returned subject,
address and token type must still match. The Website callback URL contains `authActionId`, `token_hash` and
`type=magiclink`. Fixed origins come from the deployment environment, never request input. The callback consumer
validates the current action and bound identity before token consumption. Hosted activation remains separate.

The renderer uses only `PatientEmailVerificationEmail` and its subject from the exact pinned package, with the single
`actionUrl` prop. The existing worker saves the prepared content once and reuses it and the provider idempotency key
for delivery retries. Preparation interrupted before that storage commit may generate another unsent link; it does
not represent a completed delivery. AuthAction storage never receives a token hash, URL or rendered content.
Offline unit contracts cross the public registration handler, production Auth commands and catalog, guarded private
Local API storage and Fake delivery. They prove this source behavior, not live Supabase configuration or actual mail arrival.

## Patient verification completion

`GET /auth/callback` accepts only one `authActionId`, `token_hash` and `type=magiclink`, with no `code`, `next` or
additional parameter. It checks the current active action, fixed policy, environment, expiry and correlated
unconfirmed patient identity without calling `verifyOtp`. Every link redirects to the same token-free
`/auth/confirm?type=patient-verification` state. Every syntactically valid link receives an opaque ten-minute `HttpOnly`, same-site cookie
scoped to `/auth`. The cookie contains the action, subject, fixed flow and destination, expiry, a random CSRF value
and the pending token hash. It contains no email. AES-256-GCM encryption and HMAC signing derive separate purposes from
the existing environment key ring, preserving rotation without adding configuration. Ineligible actions receive an
equally sized encrypted decoy context, so the response does not disclose an action's existence or private subject.

Only same-origin JSON `POST /auth/callback` with the matching CSRF value consumes the token. It rechecks current
Auth authority and uses an isolated Supabase client whose cookies remain buffered until the verified subject,
confirmed email and authoritative patient role match and current authority is rechecked. A mismatched provider identity
or rejected current action cannot install a session. The adapter clears obsolete cookies of the same Supabase storage
family before installing the new session, including transitions between unchunked and chunked sessions.
The confirmed session remains available while the action advances to `confirmed`. `ensurePatientOnAuth` reuses the
existing unique-subject provisioning boundary, including concurrent-create conflict recovery. Principal binding
checks the patient subject, and `completed` requires that binding. Success returns only `/patient/inquiries`.
The initial confirmation UI exposes the CSRF value, never the pending token or identity.

A successful token confirmation replaces the pending cookie with an encrypted, signed token-free receipt bounded by the
AuthAction expiry. A temporary lifecycle or provisioning failure keeps that receipt and session for completion
retry, including after the original ten-minute pending window. Retry checks the current authoritative identity
and validates the session with Supabase `getUser`; it does not consume the token again. A technical recheck failure
retains the already verified session and receipt; a definitive authority rejection discards the buffered session.
Invalid, expired, replayed,
mismatched, superseded and revoked links share the same public error. No token, link or receipt enters an AuthAction
or patient record. Next development request logging excludes `/auth/callback` queries.

The existing `/register/patient` page includes an email-only resend form. Its same-origin
`POST /api/auth/register/patient/resend` accepts only an email and returns the same no-store success for every valid
address, including unknown identities, confirmed accounts, throttling and unavailable infrastructure. Auth performs
direct subject lookup for bound actions or bounded reconciliation for unbound actions, and authorizes the current correlation's replacement through the existing
five-minute cooldown and five-per-day reservation boundary. It never creates a Supabase identity or changes a
password. An unbound pending reservation can resume identity binding. Preview Guard suppresses the operation.
The recovery link targets the resend heading directly. The controlled form clears its input after acceptance and stores no address in a URL or cookie. Delivery continues through the
existing catalog, Outbox and pinned template. Preview and Production sending remain fail-closed.

Offline HTTP and UI units cover GET/POST separation, CSRF, policy and identity mismatch, expiry, replay, provisioning
reuse, provider rejection, neutral resend and confirmed completion retry. They do not prove native database
concurrency or live Supabase delivery. Cache impact is `no-public-impact`; all Auth and patient reads remain private
and live. Clinic invitation and recovery completion paths retain their existing behavior.

## Initial clinic invitation admission

`reserveClinicInvitation` accepts only a positive `clinicStaffId` and an optional authorized `resendOf`.
It reads current staff, assigned clinic and the originating application inside its owned Serializable transaction.
The initial staff member must be approved, synchronized with a valid Supabase UUID, and linked to a completed
approved application through the same onboarding key. The application must name this clinic and staff member,
and its contact email must match the staff email. Clinic participation must remain approved without rejection
or deletion. Password-completion evidence, a legacy eligibility marker, or an earlier native invitation attempt
excludes the initial-invitation path. Missing historical password evidence is not evidence of an incomplete account.

Reservation creates one private pending 24-hour action with the current subject bound immutably and the fixed
Dashboard callback and completion destinations. It accepts no recipient or redirect. Technical retries reuse the
live action. An explicitly authorized resend can supersede only the current pending or active action, after
15 minutes and with fewer than three creations in the preceding rolling 24 hours. Confirmed actions cannot be
superseded. Expiry and replacement commit together. Progress to active, confirmed or completed rechecks the
current eligibility and subject. Revocation and expiry remain possible after source removal.

The private `clinicStaff.invitationAuthorizedAt` records the first committed reservation in the same transaction.
It survives AuthAction retention, so cleanup cannot turn an old initial invitation into a new automatic invitation.
It is distinct from `invitationAttemptedAt`, which belongs to native identity provisioning. Neither timestamp
proves password completion. Generic collection writes and copied records cannot set, replace or clear the new
marker, even with Local API access overrides. Its field is hidden from every role.

The approval hook calls the internal request boundary after storing its provisioning result. A borrowed approval
transaction is deferred rather than read from a separate transaction before commit. The existing one-minute
mail scheduler reads committed, unmarked initial staff in ID pages and prepares at most 25 actions within a
30-second budget. Ineligible sources do not prevent later IDs in that scan from being examined. Failed preparation
leaves approval, identity and business access unchanged, and reports only a safe event and staff ID. Independent
mail work still runs within the remaining invocation budget. No additional queue, scheduler or public resend route
exists. Both paths remain inactive until `auth.invitation` is declared for their hosted environment; this change
adds no Preview or Production activation. Native invitation cohorts are never automatically reinvited.

The scan restarts at the lowest ID each invocation. A sufficiently large or slow set of permanently ineligible
sources can consume the budget before later eligible sources are reached. This conditional liveness risk is a
documented low-severity follow-up, not an authorization bypass. Before hosted invitation activation, inspect the
actual candidate inventory and preparation throughput. Unit tests do not prove fairness across invocations.

The Payload-generated migration is additive: one nullable date column and its index. Both application versions
can run against the expanded schema. Keep the column during application rollback; the generated down operation
drops the durable marker and is not a rollout step. Unit tests cover eligibility, owned rollback and retry,
cooldown, rolling limits, immutable identity, safe handoff and failure isolation. Native storage and concurrency
contracts run in CI, not locally. Cache impact remains `no-public-impact` with private live reads only.
The preceding participation migration freezes its legacy backfill in migration-local SQL. It never reads the
current runtime collection schema, so installations with that migration still pending do not require the later
invitation column. Already recorded migration rows and installed legacy evidence remain unchanged.

## Recovery request admission

`reserveRecovery` accepts a normalized email and an opaque client context. It counts admitted requests before checking account eligibility. Target and IP each allow at most five admissions in the preceding rolling hour and require five minutes since their last admission. A denial writes neither dimension and does not extend either cooldown. Unknown, ambiguous or ineligible addresses consume an admitted allowance but create no AuthAction or delivery command.

The resolver reads current `patients`, `clinicStaff` and `platformStaff` records in the owned transaction. Exactly one principal with a valid Supabase UUID is required. Clinic staff additionally require `pending` or `approved` status and successful `authSync`. These authentication rules do not grant clinic business access. Eligible requests create the matching pending recovery AuthAction bound to the authoritative principal in the same transaction as both counters. No Supabase call or delivery effect runs in automatically retried work. [ADR 033](../adrs/033-adr-auth-actions-owned-transactions.md) bounds the transaction-control exception.

`bindRecoveryRequests.request` returns HTTP 200 with `{ "ok": true }` and `Cache-Control: no-store` for every syntactically valid address, including limits, missing trusted IP and infrastructure failures. Invalid address syntax returns 400 without an admission. It never serializes the internal action or exception. This internal admission adapter remains delivery-free. The public Website reset route calls the recovery command service and preserves its existing `{ "success": true }` response shape for valid addresses, including infrastructure failure, with `Cache-Control: no-store`. It does not promise identical processing times.

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

`sweep()` expires due nonterminal actions and hard-deletes terminal records once `terminalAt + 42 days` is reached. Confirmed patient/platform recovery claims remain nonterminal until completion, proven replacement or explicit operational resolution. Expiry cannot prove that a previously issued provider write stopped. Correlation cleanup still applies to these claims. The sweep processes at most 100 records per invocation in ID order. No Trash, retained content or deletion receipt is created. A repeated sweep returns committed counts and cannot extend terminal retention. The callable sweep is ready for the platform's existing execution owner; this ticket does not activate a hosted scheduler.

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

Clinic invitation reservation binds the current subject immutably. The Dashboard protocol must verify the actual
password operation before completing the action and calling this boundary. No public
completion route calls it today. An action state, email outcome, or mock alone does not prove account completion.
The [clinic participation contract](clinic-participation.md) owns the legacy import and password-usability fallback.

## Recovery email command

[Website #1990](https://github.com/findmydoc-platform/website/issues/1990) binds one `auth.password-recovery` command to
an AuthAction ID. Auth resolves exactly one current patient, clinic staff or platform staff principal through bounded
Payload lookups. A duplicate email or subject across those collections fails closed. Clinic staff must remain pending
or approved with synchronized identity. Supabase's current `app_metadata.user_type`, subject, email and ban state must
match; user-editable metadata grants no authority.

An admitted request stores the original subject and recipient HMAC using the existing private binding fields. Another
admitted request supersedes prior pending or active recovery actions in the same principal scope. The original recipient
correlation is cleared after one hour by the existing Auth sweep. No schema or migration is added.

The static catalog validates action state, environment, expiry, original recipient, subject and current principal before
acceptance, preparation and every attempt. It derives the callback, completion route and final destination from the
immutable action policy. The exact `@findmydoc-platform/email-templates@0.3.0` root exports are
`PatientPasswordRecoveryEmail`, `ClinicPasswordRecoveryEmail` and `PlatformPasswordRecoveryEmail`; each receives only
`actionUrl`. Hosted `generateLink({ type: 'recovery' })` supplies a token hash without native mail. The rendered callback
contains `authActionId`, the fixed completion `next`, `token_hash` and `type=recovery`. Final destinations remain on the
action. Website completion consumes patient and platform recovery; the Dashboard owns clinic completion.

The shared worker preserves the prepared bytes, generated link, operation and provider idempotency key on technical
retry, and suppresses changed or missing recipients and lost authority. The existing scheduler reaccepts interrupted
pending/active actions with newest-first keyset pages of at most 25, so older duplicate receipts cannot prevent a new
interruption from being examined. Duplicate receipts do not consume its 25-new-acceptance cap. One deadline bounds
all awaited steps to the remaining invocation budget, at most 30 seconds. Expiration aborts scoped Supabase requests;
late source reads or transitions cannot start another acceptance. Supabase directory scans are absent.

Local, test and CI use synthetic identity/link evidence and the shared Fake transport without constructing the live
Supabase SDK. The lazily resolved `AUTH_RECOVERY_CORRELATION_KEYS_JSON` contains the exact environment and a current-first
`keys` array of `{ version, secret }`. Keep prior keys while their recovery window remains live. Hosted recovery remains
inactive because Preview and Production have no `auth.password-recovery` activation declaration. Source validation
establishes no hosted configuration, email delivery or completion evidence.

## Website recovery completion

The existing Website reset request acknowledges every valid email neutrally. Patient and platform recovery URLs come
from the pinned catalog described above. `GET /auth/callback` accepts exactly one `authActionId`, fixed completion
`next`, 64-character token hash and `type=recovery`. It validates current action policy, environment, expiry, original
recipient correlation, unique Payload principal and authoritative Supabase subject, email, role and ban status without
consuming the token. It strips the bearer fields through a 303 redirect to `/auth/confirm?type=recovery`.

Every syntactically valid URL receives a fixed-size encrypted, signed ten-minute `HttpOnly` context scoped to `/auth`.
The context binds action, environment, flow, subject and fixed finish destination, plus a random CSRF value. Invalid
authority receives an equally sized decoy. Separate AES-GCM and HMAC purposes derive from the existing recovery key
ring, including retained rotation keys. No new configuration, recipient cookie or AuthAction field exists.

Only same-origin JSON `POST /auth/callback?flow=recovery` with the matching CSRF value consumes the token. An isolated
Supabase verification client buffers cookies until its returned session subject, email and authoritative role match.
A second current-authority check rejects revocation or changed principals before installing the session. A temporary
recheck failure preserves the verified session and token-free receipt for retry. Confirmation takes an owned
non-idempotent `active` to `confirmed` claim before initializing provider progress. Only its winner can initialize the
marker; signed technical retries observe existing progress. It replaces the pending context with a token-free
completion grant valid for ten minutes. Later retries do not renew its expiry or consume the token again.

If the claim commits but its acknowledgement is lost, the same invocation reconciles it with a fresh guarded read
while retaining its original action/subject guards. It had read active and has not emitted a metadata PUT, so a current
confirmed record proves its own claim. It can initialize once without repeating the claim. A rolled-back claim remains
active and retryable with the token-free grant. Losing the execution guard as well removes that ownership proof;
subsequent browser receipts cannot reconstruct it or reinitialize a missing marker.

`POST /auth/password/complete` requires the matching grant, CSRF, current action, principal and server-verified session.
It updates the Supabase password before advancing `confirmed` to `completed`. A signed `password-updated` receipt
preserves a known successful password operation across a temporary lifecycle failure. A `completed` receipt resumes
global sign-out after a temporary provider failure. A `signed-out` receipt resumes local cleanup without requiring a
session that the successful global logout has revoked. These receipts keep the original grant expiry, and a refreshed
completion page shows a password-free finish action. A password operation whose provider response was lost is not
proved successful by a receipt; Supabase and Payload do not share a transaction.

Confirmation and completion reserve one connection from the existing Payload pool and hold purpose-separated
environment/action and environment/subject transaction-scoped advisory try-locks through authority checks, password update, lifecycle completion, logout and local
cleanup. A competing request returns the same safe 503 without starting another password effect. Acquisition takes at
most three seconds, control statements one second each, and reserved execution thirty seconds. Connection loss or the
deadline aborts scoped provider requests and prevents later steps from starting. Healthy failure rolls back; uncertain
control or cleanup failure destroys the connection. No provider effect is automatically replayed. Every Payload data
operation remains guarded Local API; the reserved connection runs only transaction control and the advisory function.

One server-written `findmydoc_recovery_progress_v1_<environment>` app-metadata slot contains an opaque purpose HMAC,
original action expiry, bounded attempt counter and `ready`, `started` or `password-updated`. Admin PUTs contain only
that reserved top-level field; fresh no-store Admin reads verify persisted progress. Other metadata and roles are not
sent. The normal session password endpoint retains its MFA, reauthentication, current-password and SSO policies.

A matching ready marker and signed attempt version authorize one request to persist and freshly observe started,
then attempt the password once. Existing started progress cannot grant another writer permission. Known success is
saved immediately in the signed receipt before success-marker persistence. The receipt and current success marker
authorize only completion, so a copied original grant cannot replace a known successful password after Payload failure.
Only status 422 with `weak_password` or `same_password` permits a freshly persisted next attempt and replacement signed
grant, without renewing expiry. A failed or uncertain reset never publishes that next attempt. Missing or foreign
progress cannot reinitialize an old confirmed grant. A new confirmed recovery revokes older live pending/active actions
through the guarded Local API. It can replace an older confirmed claim only when the freshly fetched marker matches
that exact predecessor in ready. The non-idempotent initialization claim and signed attempt counter make each ready
write unique; a matching read establishes that write's commit, while the subject guard and authority checkpoints stop
the older request from starting later work. A missing, foreign, started or success marker leaves the older confirmed
claim fenced. Known success completes its own action first. A matching success marker skips redundant success PUTs.

An unresolved started attempt remains blocked even after its marker expiry, and a newer recovery cannot overwrite it.
An unresolved initialization or reset also remains fenced after expiry and sweep. A delayed old started/success PUT
cannot grant authority to the new action; its retained confirmed claim prevents a third recovery from replacing that
foreign marker. These unresolved claims retain their minimal lifecycle record until trustworthy operational resolution;
the normal 42-day terminal deletion starts only after that resolution.
Generic provider errors, malformed results and transport loss do not prove that no password was changed. They require
trustworthy reconciliation rather than an automatic reset or another password effect. This can leave recovery
temporarily unavailable pending operational investigation. Transport cancellation cannot retract an already committed
operation; Supabase and Payload still provide no distributed exactly-once proof.

Success uses Supabase's stateless Admin `signOut` with the server-verified session JWT and `global` scope, clears local
Supabase cookie chunks and the recovery context, then performs
a full document navigation to `/login/patient?status=recovery-complete` or `/admin/login?status=recovery-complete`.
Supabase revokes refresh-token sessions; already-issued access JWTs can remain valid until expiry, as documented in
[the Supabase sign-out contract](https://supabase.com/docs/reference/javascript/auth-signout). Payload still checks the
current principal for each authenticated request. The private action policy's destination identifiers remain unchanged.
The Admin logout API does not remove Website cookies on a provider error. The ordinary session client's `signOut`
removes its local session even when global logout fails, so that client method is unsuitable for this retry contract.

Malformed, expired, replayed, revoked, superseded, cross-flow, cross-environment and identity-mismatched links share the
same public error and request-again path. Temporary completion failures keep the grant and offer retry without another
email. The legacy unsigned recovery-cookie confirmation path is rejected. Existing invite and patient-verification
paths keep their own contracts. All callback responses use private no-store and no-referrer headers; no link, provider
detail or password enters logs, AuthActions or principal records.

Offline HTTP contracts consume the actual Fake-transport catalog URLs for both Website principal types. They cover
GET/POST separation, CSRF, authority changes, key rotation, expiry, replay, update ordering and retry after provider or
lifecycle failure. Synthetic pool boundaries cover competing completion, acquisition/control/execution deadlines,
connection loss, late results and commit/rollback cleanup. Real installed SDK contracts check logout preservation and
abort propagation. They establish no native PostgreSQL scheduling. Form units and isolated stories cover validation,
focus, safe errors and retry. Synthetic local
Chromium rendering checks the composed pages at 320, 375, 640, 768 and 1024 pixels, plus a 375-by-320 password cycle.
This evidence does not prove hosted Supabase behavior, native database races, real mobile keyboard behavior or email
arrival. Preview and Production recovery remain inactive. Cache impact is `no-public-impact`, with private live reads
and no public invalidation.
