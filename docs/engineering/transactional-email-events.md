# Transactional email event invariants

[Website #1857](https://github.com/findmydoc-platform/website/issues/1857) implements the event storage contract in
[the platform foundation](transactional-email-platform-foundation.md). The public command port is unchanged.

## Private provider storage

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

Payload's native `afterSchemaInit` hook declares the partial unique provider-identity index. The generated migration
`20260916_050558_transactional_email_event_invariants` adds the three approved event values and nullable
`sourceOccurredAt`, then replaces the existing provider-identity index with uniqueness for non-null, nonempty identities.
The existing `(outbox, sequence)` unique index remains in place. Runtime persistence uses the Payload Local API only.

This is an additive schema extension plus an index predicate change. Existing worker writes remain compatible; the new
provider storage requires the migration. The application rejects empty identities even though the partial index excludes
them. The generated down migration must not run after the new event types are stored without a separate data recovery
decision; it removes those enum values and the source-time field.

## Evidence

`tests/integration/transactionalEmail.events.test.ts` uses real Payload and disposable Postgres. It covers concurrent
worker/provider appends, concurrent identity deduplication, sequence rollback, direct update denial, the full forbidden
state-transition matrix, unchanged retention clocks, private access, content-free columns, and PostgreSQL constraint
violations. Fresh test-database setup applies the generated migrations before these checks. Fetch and HTTP(S) guards
reject external traffic. The remaining mail acceptance, caller-transaction, worker, and retention suites cover their
existing boundaries together with these changes.
