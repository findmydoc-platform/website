# Transactional email worker

[Website #1854](https://github.com/findmydoc-platform/website/issues/1854) and
[Website #1855](https://github.com/findmydoc-platform/website/issues/1855) implement synthetic processing and bounded recovery under
[ADR 031](../adrs/031-adr-transactional-email-technical-activation-gates.md) and the [foundation contract](transactional-email-platform-foundation.md).
The public command port remains unchanged. The private Website worker receives an accepted operation identifier.
The committed Preview and Production activation for `clinic.registration-received` can enqueue operations for it.
No other product command is active in either hosted environment.

## Hosted scheduler boundary

The private GET route at `/api/internal/transactional-email/worker` accepts only a dedicated `CRON_SECRET` in the
Authorization header. It compares fixed-length digests with a timing-safe comparison before loading Payload or the
worker. Missing or misplaced credentials return 401 without a worker call, storage read, sweep, provider call, or
application log. POST does not run the worker. Local and test runs remain explicit-only.

The Preview guard delegates this exact worker path to the route's authentication and performs no Supabase session
lookup for it. Neighboring internal API paths retain their Preview session checks.

After a hosted worker capability is available, an authenticated invocation runs the safety and retention sweep first,
then examines candidate operations in ID order. The worker makes the final due and lease decision. The sweep stops
when 50 seconds remain in the invocation budget. If content scrubbing is incomplete, the invocation starts no claims;
unfinished metadata deletion can continue on the next call without blocking claims. It starts at most five claims
and processes at most two at once. A claim is refused when fewer than 25 seconds
remain in the 240-second request budget, including initialization and a second check inside the claim transaction. The route has a
300-second function limit. Existing two-minute leases protect against overlap.

The route is private-live with `no-public-impact`: it has no public read, rendered output, cache tag, or revalidation
event. Hosted processing remains closed before Payload initialization until the environment-specific real delivery
capability is available; the existing worker refuses hosted fake delivery. No command is activated by this route.

Production and Preview each own an independent one-minute scheduler, authentication, credentials, runtime
configuration, scheduling authority, and failure domain. Production never calls Preview. Neither environment can
access or store the other's credentials. Shared source code does not grant runtime authority across environments.

The root `vercel.json` schedules only the Production Website worker. Vercel Cron invokes only Production deployments,
so Preview owns the separate application in `apps/preview-email-scheduler`. Its `/api/tick` function authenticates the
Vercel Cron request, then invokes only the fixed Preview worker URL with the Preview scheduler credential. It refuses
redirects, any other target, and any logical environment other than Preview. One Preview failure produces a 503 in
that application; it cannot affect Production scheduling or invoke the Production worker. The relay has a 250-second
request timeout and a 300-second function limit. It does not retry within a tick.

### Deployment and credential ownership

| Component | Vercel project and scope | Schedule | Runtime configuration |
| --- | --- | --- | --- |
| Production Website | `findmydoc-portal`, Production | Root cron, once per minute | Production-only `CRON_SECRET` |
| Preview Website | `findmydoc-portal`, Preview | Receives only the Preview scheduler's requests | Preview-only `CRON_SECRET` |
| Preview scheduler | `findmydoc-preview-email-scheduler`, Production | Its own cron, once per minute | Preview `CRON_SECRET`, `SCHEDULER_ENVIRONMENT=preview`, `PREVIEW_WORKER_URL=https://preview.findmydoc.eu/api/internal/transactional-email/worker` |

The Preview scheduler's Vercel Production scope is the platform slot required to run Cron. The application belongs
exclusively to Preview. Its project has no Production Website credential, database credential, provider credential,
or Vercel deployment token. The Website runtime has no dependency on this separate application. Local development,
tests, and CI run no background schedule. Vercel Preview deployments of the scheduler application refuse to relay
requests.

Provision a fresh Preview `CRON_SECRET` with at least 32 cryptographically random bytes. Authorized provisioning
generates it in memory and writes the same value directly to the two Preview-owned scopes through the CLI's stdin.
It never reads, compares, changes, or copies the Production Website secret. Each Website secret is scoped only to its
own environment. Do not export, pull, log, or persist credential values in checkout files, CI artifacts, or PRs.
Verify only presence, sensitive storage, and scope metadata. If provisioning is incomplete, deployment and activation
stop.

Deploy the Preview application independently from its own directory after provisioning:

```sh
cd apps/preview-email-scheduler
vercel-findmydoc deploy --local-config vercel.json --target production --yes --scope findmydoc --project findmydoc-preview-email-scheduler
```

Do not deploy the repository root to the Preview scheduler project. The application has no dependencies and does not
need the Website environment or an environment pull. Production Website rollout remains part of the joint platform
release. Scheduling does not activate product commands or bypass the existing hosted-delivery capability gate.

After deployment, verify each project's own one-minute cron separately, confirm the Preview target and environment
metadata, and confirm that unauthenticated requests return 401 without worker activity. Deployment protection must
allow the Preview scheduler to reach the private application-authenticated endpoint. If protection blocks that path,
stop for an explicit platform configuration decision; do not reuse another environment's bypass credential.
Authorized acceptance checks use synthetic work only. No real-email test is part of scheduler activation.

To stop one scheduler, disable that project's cron in Vercel. A Vercel instant rollback does not update active cron
definitions; verify or disable the affected project's schedule explicitly. The other environment keeps its cadence.
See [Vercel Cron setup](https://vercel.com/docs/cron-jobs/quickstart) and
[Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Claim and preparation

The worker uses native Payload Local API calls inside short serializable transactions. Claim reads the operation,
checks its environment and processing state, and stores a random UUID token with a two-minute lease. Concurrent
claims retry their complete transaction through the existing bounded transaction helper. Only one succeeds.
An expired lease can be reclaimed once its retry delay is due, including after a started attempt. There is no lease renewal.

Every later write passes its token through the transaction-bound private capability. The collection hook rejects
expired or replaced tokens, lease renewal, illegal state changes, recipient redirection, and prepared-content edits.
Claim and storage transactions finish before link generation, rendering, or delivery. Each step needs more than five
seconds of remaining lease and delivery-deadline budget. Preparation steps time out after four seconds. Lettermint delivery owns a separate 20-second total timeout and requires more than 25 seconds of lease and delivery-deadline budget before starting. The delivery adapter receives an abort signal. A delivery timeout or thrown error is ambiguous. The injected clock controls policy tests.

The static synthetic catalog revalidates eligibility and recipient binding before link generation, rendering, and
delivery. A missing or changed recipient ends processing with the catalog's suppressed or failed outcome. It never
redirects the operation. The fake link generator uses example.test and performs no network call. A typed React Email
notification renders HTML and plain text. The worker commits the exact recipient, subject, HTML, and text before any
attempt starts. Reclaim after this commit reuses those bytes without generating another link.

Every preparation step also requires an explicit `cleared` decision from the private suppression lookup. Missing,
unavailable, rejected, or failed lookup results stop before the next link, render, serialization, or delivery step.
A suppression hit records the existing suppressed outcome. Activation and the Preview allowlist remain separate
checks and cannot grant suppression clearance. A worker with a verified provider binding uses the environment-scoped private suppression store. An injected synthetic
decision cannot override its result. Fake-only Local, test, and CI callers without that binding still supply an explicit
synthetic decision. See [suppression storage and correlation](transactional-email-suppression.md).

## Immutable provider preparation

[Website #1895](https://github.com/findmydoc-platform/website/issues/1895) adds the private preparation boundary.
After eligibility, recipient binding, activation, allowlist, and suppression checks, one short Payload transaction
serializes the prepared content with the verified sender and route. It stores `preparedProviderRequest`,
`providerTeamId`, `providerProjectId`, `providerRouteId`, and the immutable `providerRecipientDigest` together with the first attempt marker and event. No
delivery adapter sees the request until commit succeeds. An audit or commit failure rolls back that transaction.

The UTF-8 JSON string has a fixed field order and a closed schema. It contains one recipient, subject, HTML, text,
configured sender and route slug, disabled open/click tracking, and only operation ID, command type, and environment
metadata. The persistence guard rejects unknown fields, duplicate JSON keys, content mismatches, partial bindings,
and edits to prepared bytes. It never stores credentials in the body or binding. The request shape follows the
[Lettermint single-message API](https://lettermint.co/docs/api-reference/sending/send), checked on 27 September 2026.

Retries use the stored string and provider key unchanged. A reviewed sender change cannot rebuild that string.
Another team, project, route ID, route slug, or environment fails before another attempt; missing provider configuration cannot
downgrade a prepared operation to fake delivery. Target and activation policy must come from the same verified
binding. The private worker test option accepts synthetic bindings only in the Vitest test runtime. Hosted selection
remains closed until the real transport and suppression integration exist. No registry or product command is enabled.

The generated migration adds only four nullable columns. Old and new application versions can use the expanded
schema. An application rollback keeps those columns: dropping them after provider preparation would discard the
durable request and destination. The generated down migration is tested only on disposable data containing an
unprepared operation, followed by up and an unchanged-row check. It is not a hosted rollback procedure.

The preparation integration suite uses real Payload and PostgreSQL, a separate committed-row observer, explicit
synthetic suppression decisions, and a controlled delivery adapter. It checks durable-before-delivery preparation,
same-byte retries, target drift, forbidden fields, atomic rollback, private writes, content scrubbing, and 42-day
binding deletion. Network guards reject fetch and HTTP(S) calls. The transport protocol is described below.

## Controlled Lettermint transport

[Website #1905](https://github.com/findmydoc-platform/website/issues/1905) adds `lettermintDelivery.ts` behind the private
worker composition. It sends the stored JSON string directly to the fixed single-message HTTPS endpoint. The only
application headers are the fingerprint-bound project token, the stored foundation idempotency key, and JSON content
type. Fetch uses no cache, credentials, redirect following, SDK, or automatic retry layer. Binding drift stops before
another attempt. A recreated worker can use a newly verified token and reviewed activation evidence for the same
team, project, and route without rebuilding the stored request.

The adapter owns one 20-second timer covering connection, headers, and body reading. It aborts the transport and
returns ambiguity even when the controlled transport ignores cancellation. Response decoding accepts at most 64 KiB
of valid UTF-8. Missing, malformed, truncated, oversized, or unfinished success responses remain ambiguous. The worker
reserves another five seconds for recording the outcome, preserves its six-attempt schedule, and ignores all provider
retry timing. Ordinary fake delivery keeps the foundation's four-second timeout.

HTTP 202 with a valid message identifier and a known acceptance status records provider acceptance and scrubs content.
The accepted statuses are `pending`, `queued`, `processed`, `delivered`, `opened`, `clicked`, `soft_bounced`,
`hard_bounced`, and `spam_complaint`. They establish acceptance only; later delivery state belongs to verified events.
`scheduled`, `quarantined`, and unknown statuses remain ambiguous. HTTP
408, 425, 429 and 5xx schedule a foundation retry. An exact structured `code` of `invalid_idempotent_request` on 409
fails permanently; `concurrent_idempotent_requests` and unknown 409 responses retain the same operation. Free-form
provider messages never select a code. Other 4xx responses are permanent. `suppressed`, `policy_rejected`, `blocked`, `failed`, `canceled`, and `unsubscribed`
are permanent and do not create local suppression. No outcome selects a fallback. The adapter emits only the four
foundation outcome types with closed safe codes. The worker stores those codes in private events. Authentication
failures emit a fatal structured signal; idempotency invariants and permanent rejections emit an error signal, using
only the existing safe log fields.

The generated migration expands only the event outcome enum. Previous application versions can run against the
expanded schema. Keep the expanded enum during an application rollback: the generated down migration cannot preserve
events that already use the new codes and is not a hosted rollback procedure.

The integration suite starts at the real worker, uses real Payload and PostgreSQL, synthetic configuration and
explicit suppression decisions, and replaces only the external HTTP transport. Network guards deny fetch and HTTP(S).
It covers committed request bytes and headers, accepted identifiers and scrubbing, outcome mapping and safe signals,
connection/body timeout boundaries, fixed retry timing and exhaustion, same-byte and same-key retries after token
rotation, target drift, environment isolation, and deadline budget. Time is controlled without waiting 20 seconds.

Local development and CI keep explicit fake execution. Only Vitest in the test runtime accepts the controlled HTTP
transport. Preview hosted worker selection is available only through its fingerprint-verified target, minimized
outbound capability, suppression lookup, command activation, and recipient digest allowlist. Production uses its own
fingerprint-verified target, credentials, preflight, and activation record. Its committed declaration enables only
`clinic.registration-received`; every other command remains unavailable without fallback.

## Fake provider acceptance and privacy

The worker commits attempt count and an attempt-started event before calling the fake delivery adapter. The adapter
returns provider acceptance, which does not claim delivery to a recipient server. Provider acceptance and terminal
outcomes clear command data, recipient address, prepared content, and lease fields in the same transaction as their
events. Retained fields follow the foundation metadata allowlist. A terminal event failure rolls back scrubbing and
state together.

The delivery seam receives the exact stored message, internal provider key, and, when prepared, the immutable provider
request and content-free target. Structured server logging allows
only operationId, commandType, attemptNumber, outcomeCode, and environment. Raw preparation failures are discarded.
Tests may inject synthetic link/delivery behavior and a log observer through this private composition seam. Hosted
runtime detection runs first and rejects Preview and Production, even when test dependencies are supplied.

## Retry and deadlines

The Website owns six attempts and the fixed delays of one minute, five minutes, thirty minutes, two hours, and eight
hours after each preceding retryable or ambiguous result. The worker persists `nextAttemptAt` and releases its lease
when waiting. Permanent and suppressed results end processing immediately. No environment or command field changes
this policy. If the next attempt cannot fit before the deadline, or six attempts are consumed, the operation expires
and scrubs its transient fields atomically.

Command acceptance stores `deliveryDeadline` once. Non-Auth operations use acceptance time plus 24 hours. Auth catalog
entries supply the authoritative original action time and approved link lifetime. The module subtracts five minutes;
it rejects Auth acceptance without that source information. Preparation cannot extend the stored deadline. Legacy
non-Auth rows without the new nullable field derive the same bound from `createdAt`; legacy Auth rows fail closed.

An ambiguous result fixes `firstAmbiguousAt` to the start of that request. Later retries preserve it, the provider key,
and every prepared byte. The effective deadline is the earlier of the stored delivery deadline and 24 hours after
that first ambiguous request. Each retry revalidates current eligibility and recipient binding before delivery.

A started attempt without a durable result remains prepared. After its lease and retry delay expire, reclaim records
the ambiguity from the original request start and consumes the next attempt without rendering or generating a link.
The deterministic crash seam runs after fake return and before result persistence. It is accepted only inside the test
runner in test or CI runtime. It is unavailable in local application execution and hosted environments.

Orphan scrubbing, retention, and provider-event handling remain with their approved subsequent tickets.

## Persistence and validation

The generated migration adds nullable/defaulted worker fields and closed event values. It makes transient command
and recipient columns nullable so scrubbing can clear them. Its up migration preserves existing rows and remains
compatible with the preceding acceptance code. The retry migration adds nullable deadline/scheduling fields and closed retry event values without rewriting existing rows. A down migration after processing requires a separate data-safety
assessment because scrubbed content cannot be reconstructed.

Both collections remain private-live with no-public-impact. There are no public reads, cache tags, discovery paths,
or invalidation calls. Existing collection privacy, permission, and cache tests remain applicable.

The worker integration suite uses real Payload and disposable Postgres. A separate observer checks committed payload
and attempt history before the fake call, concurrent claims, reclaim, stale tokens, preparation reuse, changed
recipients, remaining lease budget, atomic terminal rollback, and the retained metadata allowlist. Fetch and HTTP(S)
guards cover Local, test, and CI, including repeated retries. The suite checks every delay, the six-attempt limit, deadline budget boundaries, original Auth validity, fixed ambiguity windows, crash recovery, concurrent reclaims, and adapter timeout behavior. The worker has no provider, Supabase, or PostHog integration.
