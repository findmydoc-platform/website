# Transactional email worker

[Website #1854](https://github.com/findmydoc-platform/website/issues/1854) and
[Website #1855](https://github.com/findmydoc-platform/website/issues/1855) implement synthetic processing and bounded recovery under
[ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md) and the [foundation contract](transactional-email-platform-foundation.md).
The public command port remains unchanged. The private Website worker receives an accepted operation identifier.
No product catalog entry or hosted delivery activation invokes it.

## Hosted scheduler boundary

The private GET route at `/api/internal/transactional-email/worker` accepts only a dedicated `CRON_SECRET` in the
Authorization header. It compares fixed-length digests with a timing-safe comparison before loading Payload or the
worker. Missing or misplaced credentials return 401 without a worker call, storage read, sweep, provider call, or
application log. POST does not run the worker. Local and test runs remain explicit-only.

After a hosted worker capability is available, an authenticated invocation runs the safety and retention sweep first,
then examines candidate operations in ID order. The worker makes the final due and lease decision. The sweep stops
when 50 seconds remain in the invocation budget. If content scrubbing is incomplete, the invocation starts no claims;
unfinished metadata deletion can continue on the next call without blocking claims. It starts at most five claims
and processes at most two at once. A claim is refused when fewer than 25 seconds
remain in the 240-second invocation budget, including a second check inside the claim transaction. The route has a
300-second function limit. Existing two-minute leases protect against overlap.

The route is private-live with `no-public-impact`: it has no public read, rendered output, cache tag, or revalidation
event. Hosted processing remains closed before Payload initialization until the environment-specific real delivery
capability is available; the existing worker refuses hosted fake delivery. No command is activated by this route.

Production and Preview need independent one-minute invocations and distinct `CRON_SECRET` values. Vercel Cron can
invoke the Production deployment, but it does not invoke Preview deployments. This change does not add a cron
definition until Preview has an independent scheduler and both hosted bindings are ready. Production never calls
Preview. Neither environment holds the other environment's scheduler credential.

## Claim and preparation

The worker uses native Payload Local API calls inside short serializable transactions. Claim reads the operation,
checks its environment and processing state, and stores a random UUID token with a two-minute lease. Concurrent
claims retry their complete transaction through the existing bounded transaction helper. Only one succeeds.
An expired lease can be reclaimed once its retry delay is due, including after a started attempt. There is no lease renewal.

Every later write passes its token through the transaction-bound private capability. The collection hook rejects
expired or replaced tokens, lease renewal, illegal state changes, recipient redirection, and prepared-content edits.
Claim and storage transactions finish before link generation, rendering, or delivery. Each step needs more than five
seconds of remaining lease and delivery-deadline budget. Async steps time out after four seconds, leaving a margin for recording the outcome. The delivery adapter receives an abort signal. A delivery timeout or thrown error is ambiguous. The injected clock controls policy tests.

The static synthetic catalog revalidates eligibility and recipient binding before link generation, rendering, and
delivery. A missing or changed recipient ends processing with the catalog's suppressed or failed outcome. It never
redirects the operation. The fake link generator uses example.test and performs no network call. A typed React Email
notification renders HTML and plain text. The worker commits the exact recipient, subject, HTML, and text before any
attempt starts. Reclaim after this commit reuses those bytes without generating another link.

## Fake provider acceptance and privacy

The worker commits attempt count and an attempt-started event before calling the fake delivery adapter. The adapter
returns provider acceptance, which does not claim delivery to a recipient server. Provider acceptance and terminal
outcomes clear command data, recipient address, prepared content, and lease fields in the same transaction as their
events. Retained fields follow the foundation metadata allowlist. A terminal event failure rolls back scrubbing and
state together.

The delivery seam receives only the exact stored message and internal provider key. Structured server logging allows
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
