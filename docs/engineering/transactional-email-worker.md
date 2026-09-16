# Transactional email worker

[Website #1854](https://github.com/findmydoc-platform/website/issues/1854) implements synthetic processing under
[ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md) and the [foundation contract](transactional-email-platform-foundation.md).
The public command port remains unchanged. The private Website worker receives an accepted operation identifier.
No route, schedule, product catalog entry, or hosted activation invokes it.

## Claim and preparation

The worker uses native Payload Local API calls inside short serializable transactions. Claim reads the operation,
checks its environment and processing state, and stores a random UUID token with a two-minute lease. Concurrent
claims retry their complete transaction through the existing bounded transaction helper. Only one succeeds.
An expired lease can be reclaimed before a delivery attempt starts. There is no lease renewal.

Every later write passes its token through the transaction-bound private capability. The collection hook rejects
expired or replaced tokens, lease renewal, illegal state changes, recipient redirection, and prepared-content edits.
Claim and storage transactions finish before link generation, rendering, or delivery. Each step needs more than five
seconds of remaining lease budget. The injected clock controls policy tests.

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

Started-attempt recovery and retry scheduling belong to #1855. This worker therefore leaves a started attempt for that
recovery path after a process interruption. It does not reclaim it or silently repeat delivery. Deadline calculation,
orphan scrubbing, retention, and provider-event handling remain with their approved subsequent tickets.

## Persistence and validation

The generated migration adds nullable/defaulted worker fields and closed event values. It makes transient command
and recipient columns nullable so scrubbing can clear them. Its up migration preserves existing rows and remains
compatible with the preceding acceptance code. A down migration after processing requires a separate data-safety
assessment because scrubbed content cannot be reconstructed.

Both collections remain private-live with no-public-impact. There are no public reads, cache tags, discovery paths,
or invalidation calls. Existing collection privacy, permission, and cache tests remain applicable.

The worker integration suite uses real Payload and disposable Postgres. A separate observer checks committed payload
and attempt history before the fake call, concurrent claims, reclaim, stale tokens, preparation reuse, changed
recipients, remaining lease budget, atomic terminal rollback, and the retained metadata allowlist. Fetch and HTTP(S)
guards cover Local, test, and CI. The worker has no provider, Supabase, or PostHog integration.
