# Transactional email scrubbing and retention

[Website #1856](https://github.com/findmydoc-platform/website/issues/1856) implements the cleanup contract in
[the platform foundation](transactional-email-platform-foundation.md), under
[ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md).

## Worker entry point

Every private worker entry (`run`, `claim`, and `processClaim`) runs the safety sweep before preparing another
message. Content scrubbing finishes before metadata deletion starts. `run()` without an operation identifier performs the same sweep without delivery work. The sweep selects
only the current runtime environment, pages candidates by identifier, and processes each operation in a short
serializable Payload transaction. Concurrent sweeps reread each candidate and tolerate an already deleted operation.

Queued and prepared operations strictly past their effective delivery deadline become expired. Worker and sweep
share the same deadline policy. Legacy non-authentication rows without a stored deadline use creation time plus
24 hours; legacy authentication rows without an authoritative deadline expire immediately. The first ambiguous
attempt also caps delivery at 24 hours. Candidate selection includes nullable legacy deadlines, and the transaction
rechecks the effective deadline before changing a record. That transaction removes
command data, recipient address, rendered subject/HTML/text, retry scheduling, and lease fields; records terminal
and scrub timestamps; and appends expiry and scrub events. A worker with an older or in-flight claim cannot restore
the payload or overwrite that outcome after losing its lease. Existing terminal outcomes, including accepted and
later delivery states, remain unchanged when the sweep repairs leftover content. An existing terminal timestamp is
immutable, so later metadata activity cannot extend retention.

Both normal worker completion and the sweep use the same transient-field list, including `preparedProviderRequest`.
The exact serialized provider body is cleared with the recipient and rendered content. The immutable
`providerTeamId`, `providerProjectId`, `providerRouteId`, and `providerRecipientDigest` remain as content-free metadata until joint deletion.
Remaining non-null columns belong to the foundation's content-free metadata allowlist.

## Joint deletion

Scrubbed terminal operations become eligible for hard deletion 28 days after their original terminal timestamp.
The same worker entry checks this boundary on every invocation, which also satisfies the daily deletion contract.
It deletes all associated events and their outbox record in one transaction. Failure in either deletion rolls back
both. Only this retention path grants exact, single-use event and outbox deletion permissions bound to the live
transaction. Normal command, worker, and collection access cannot delete event history.

Deduplication remains available while metadata exists. After final deletion, the former operation reference no longer
resolves to that operation. No separate cleanup service, scheduler, provider integration, or runtime activation is
introduced. Preview and Production remain fail-closed without their real adapters.

## Scheduling and Production gate

The eventual runner must call this worker at intervals of at most 30 minutes, including empty runs. Controlled-clock
integration tests simulate that cadence and prove scrubbing within one hour after delivery expiry. They exercise
the exact 28-day boundary and deletion within the following 24 hours. These are execution contracts; this change
does not activate a runner or guarantee execution when an eventual runner is unavailable.

The 28-day period follows the approved
[transactional email Product Spec](https://app.notion.com/p/3f4283c73e618101ba7edc7ee0530850).
This product decision does not constitute Legal or Privacy approval. Processing purpose, HMAC key ownership and
rotation, and the deletion mechanism remain separate governance questions. Suppression retention is unchanged.

## Rollout of the 28-day policy

After deployment, the next normal worker sweep also deletes eligible existing operations that are between 28 and
42 days old, together with their events. Eligibility still requires a terminal outcome and completed scrubbing,
uses the original terminal timestamp, and is restricted to the worker's runtime environment. No migration or
backfill is needed: both candidate selection and the transactional deletion guard use the same policy constant.

Reverting the duration cannot restore history already deleted. The shorter deduplication window applies to this
outbox history only. Suppression records, AuthActions, and other data classes retain their own existing policies.
Complaint handling and Legal documents are not changed by this rollout.

## Verification and cache boundary

`tests/integration/transactionalEmail.retention.test.ts` uses real Payload and disposable test Postgres, an injected
clock, independent committed-row observations, synthetic interrupted records, and network guards. It covers empty
runs, ordering before preparation, deadline and retention boundaries, metadata allowlisting, repeated sweeps,
concurrent sweeps and in-flight workers, scoped deletion access, atomic rollback, pagination, and runtime isolation.
The existing acceptance, transaction, worker, permission, and collection contracts remain applicable.

Cache decision: **no-public-impact**. Both collections remain in the existing `private-live` policy. There are no
public readers, rendered/discovery dependencies, cache tags, or invalidation events. The schema is unchanged; this
change requires no migration.
