# Transactional email event invariants

[Website #1857](https://github.com/findmydoc-platform/website/issues/1857) implements the event storage contract in
[the platform foundation](transactional-email-platform-foundation.md). The public command port is unchanged.

## Private provider storage

`POST /api/internal/transactional-email/lettermint/[environment]` verifies the raw signature and provider target before
projecting the closed envelope. `applyLettermintEvent` receives only those projected fields. It resolves the opaque
operation metadata, then checks the command, deployment environment, immutable team/project/route binding, and any
existing provider message reference. A provider message reference alone never selects an operation. An unmatched
or mismatched event returns success with only `provider-event-unmatched` or `provider-event-mismatch`, leaves storage
unchanged, and emits that fixed reconciliation code through the native logger.

The short serializable Payload transaction records one unique provider result together with all allowed effects.
It compares the retained event type, source time, outbox relationship, and message reference when recognizing a
replay. An identical replay changes neither the sequence nor history. Provider timestamps remain informational.
Provider reasons, subjects, recipients, SMTP responses, tags, and unapproved metadata never enter this transaction.

The webhook uses the absolute response and start-new-work deadline from
[ADR 030](../adrs/030-adr-bound-transactional-email-webhook-processing.md). Expiration stops new operations and commit
initiation and returns the fixed temporary `503`. Transaction-local controls bound statements and lock waits.
A commit already in progress may finish later with an outcome unknown to the caller. Its identical provider retry
either recognizes the committed event or applies the rolled-back event once. The response timer never turns an
unconfirmed commit into success. Conflicting replay remains a mutation-free mismatch.

Created, sent, delivered, hard-bounce, soft-bounce, complaint, and failed feedback establish provider acceptance for
a prepared operation. Acceptance clears transient fields and records acceptance and scrub events. A delivery,
hard-bounce, or complaint then follows the existing `accepted` transition in the same transaction. Provider suppression
and policy rejection fail a prepared operation without inventing a post-acceptance state. Accepted and terminal
records retain their original acceptance, retention, and scrub times. A later conflicting terminal result adds
history without replacing the terminal state. Unsubscribed events add `provider.event-ignored` only when correlated
and emit a fixed drift code. They do not change delivery state.

The transaction's private writer owns sequence allocation and appends. Worker completion and verified feedback
reread the outbox in separate serializable transactions. The outbox update takes PostgreSQL's row lock; a competing
write from an older snapshot fails and retries the complete transaction, including correlation and replay checks.
The first allowed terminal delivery state wins. Later distinct events retain their own sequence and provider result
without replacing that state. Provider timestamps do not choose the winner.

If feedback established acceptance before the synchronous worker result, matching worker acceptance succeeds without
requiring the cleared lease or writing another acceptance, scrub event, or provider reference. A conflicting worker
reference changes nothing and emits only `provider-event-mismatch` after its read transaction completes. Retryable,
ambiguous, and permanent worker results cannot overwrite feedback after it clears the lease.

Suppression effects in #1898 can extend the existing event transaction independently of terminal-state precedence.
Recipient fields are discarded; recipient-digest validation for suppression stays
with the suppression integration. Hosted command acceptance and delivery remain disabled, and no provider resource,
credential, scheduler, or product command is activated.

## Foundation storage seam

`appendProviderEvent` is a private Website integration seam. It accepts an outbox identifier, a nonempty opaque provider
event identifier, one of `delivery.delivered`, `delivery.bounced`, or `delivery.complained`, and an optional source time.
It rejects additional fields and identities outside the bounded alphanumeric, underscore, and hyphen form. It performs
no network request. Local and test inputs are synthetic; hosted environments remain disabled without real adapters.

The delivery edge owns verification, provider mapping, and precedence. An input can record history without changing
state. An explicit `transitionTo` must match the event type and can only change `accepted` to `delivered`, `bounced`,
or `complained`. Contradictory transitions fail; storage does not choose which outcome wins. The delivery edge can
record an outcome it explicitly chooses to ignore by omitting `transitionTo`. A duplicate identity returns the original
event without reapplying an outcome or adding history. Reusing an identity for a different operation is denied.

Each append reads the current outbox counter, increments it, and inserts its event inside one serializable Payload
transaction. Worker writes use the same transaction and counter contract. Serialization and exact event uniqueness
conflicts retry the complete short transaction at most three times. A failed event insert rolls back the counter.
A provider timestamp is informational; only the per-operation sequence orders history.

The outbox update authorizes a transaction-bound, one-use event append. Direct internal event updates are denied, as
are ordinary Payload calls and forged context objects. The approved retention transaction alone can delete events.
Late feedback preserves `terminalAt`, `scrubbedAt`, and the scrubbed payload, so it cannot extend the 42-day retention
clock. No public cache, tag, route, or invalidation depends on either private collection.

## Schema and migration

The generated additive migrations `20260927_073954_transactional_email_provider_results` and
`20260927_074230_transactional_email_provider_mapping` add the seven closed provider event types and nullable
`providerEventType` and `providerMessageId` columns. Existing rows and the provider identity and sequence indexes
remain unchanged. Both application versions can use the expanded schema. Roll back the application while retaining
these columns and enum values; a down migration after provider results exist requires a separate data recovery
decision.

Payload's native `afterSchemaInit` hook declares the partial unique provider-identity index. The generated migration
`20260916_050558_transactional_email_event_invariants` adds the three approved event values and nullable
`sourceOccurredAt`, then replaces the existing provider-identity index with uniqueness for non-null, nonempty identities.
The existing `(outbox, sequence)` unique index remains in place. Runtime persistence uses the Payload Local API only.

This is an additive schema extension plus an index predicate change. Existing worker writes remain compatible; the new
provider storage requires the migration. The application rejects empty identities even though the partial index excludes
them. The generated down migration must not run after the new event types are stored without a separate data recovery
decision; it removes those enum values and the source-time field.

## Evidence

`tests/integration/transactionalEmail.webhook.test.ts` crosses the real Next.js request dispatcher and real Payload
with signed synthetic envelopes. It covers all nine mappings, ambiguous acceptance, identical replay, binding
mismatch, source-time ordering, field disposal, and immediate and deferred database failures. A PostgreSQL trigger
rejects the provider result at INSERT or COMMIT; independent observations prove complete rollback and successful
single application after recovery. Network guards prohibit external traffic. The request tests retain the signature,
rotation, byte-limit, target, and environment checks from #1896.

Deadline tests stall a real Payload hook, block PostgreSQL statements and locks, expire immediately before commit,
and delay deferred commit triggers beyond the HTTP deadline. Both late success and late failure return `503` before
the database completes and reconcile to one event/effect on retry. Bridge tests reject unsupported adapter/session
capabilities and unsafe control results and constrain emitted SQL to the fixed transaction-local controls.

Coordinated request tests pause real Payload reads after the worker parses its controlled HTTP response, and let
either the worker or webhook commit first. Other barriers force overlapping identical, conflicting, and distinct
provider events to read the same snapshot. The tests prove complete retries, consecutive event sequences, stable
provider references, and first-terminal precedence. A two-operation race at READ COMMITTED isolates Payload's native
provider-ID unique-violation translation from serializable conflicts. Its losing transaction rolls back acceptance,
scrubbing, and every sequence before returning the winning event's mismatch result on retry. Deferred PostgreSQL
COMMIT failures prove successful whole-transaction retry and exhaustion after three attempts. Independent committed
observations remain unchanged during every failed attempt; a later provider retry applies at most once.

These changes require no schema migration. Cache decision remains `no-public-impact`: the existing
`collection:private-operational` policy classifies both collections as `private-live`, without public readers,
discovery consumers, tag families, affected paths, or revalidation events. Collection privacy and cache architecture
contracts remain the boundary checks. A public delivery-status consumer requires a new cache decision.

`tests/integration/transactionalEmail.events.test.ts` uses real Payload and disposable Postgres. It covers concurrent
worker/provider appends, concurrent identity deduplication, sequence rollback, direct update denial, the full forbidden
state-transition matrix, unchanged retention clocks, private access, content-free columns, and PostgreSQL constraint
violations. Fresh test-database setup applies the generated migrations before these checks. Fetch and HTTP(S) guards
reject external traffic. The remaining mail acceptance, caller-transaction, worker, and retention suites cover their
existing boundaries together with these changes.
