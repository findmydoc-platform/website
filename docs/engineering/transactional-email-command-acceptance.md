# Transactional email command acceptance

[Website #1852](https://github.com/findmydoc-platform/website/issues/1852) and
[Website #1853](https://github.com/findmydoc-platform/website/issues/1853) implement command acceptance and transaction ownership from
[the foundation contract](transactional-email-platform-foundation.md). [ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md)
continues to govern the platform.

## Command boundary

Product code receives `TransactionalEmailCommands` from `src/features/transactionalEmail/index.ts`. This import exports
only command and receipt types and typed errors. The private Website integration binds authentication and Payload to
that port. Catalogs, storage capabilities, transaction handling, and environment selection remain internal imports.

The nine approved command types use a strict runtime schema. Operation references and synthetic source identifiers
are UUIDs. Each command has one named source identifier, such as `registrationId` or `recoveryId`. These identifiers
address synthetic test records; they do not implement the source loading or recipient policy of a product flow.
Extra properties and unknown command types fail before persistence. The runtime catalog has no product entries.
The tests supply a static synthetic catalog, which resolves only addresses under `example.test`.

An acceptance returns exactly `operationId`, `acceptedAt`, and `deduplicated`. Validation and source authorization run
before both initial acceptance and duplicate receipts. Without a caller transaction, the module owns a serializable read-write transaction, writes one outbox record and its
first event, and returns only after commit. A duplicate preserves the original record, acceptance time, recipient
binding, provider key, and event history. Serialization and business-key conflicts retry the whole transaction up to
three attempts.

## Payload commit outcome

The pinned `@payloadcms/drizzle@3.88.0` dependency needs
`patches/@payloadcms__drizzle@3.88.0.patch` to propagate native commit errors. Its original transaction
promise consumes PostgreSQL commit failures after transaction initialization. The original commit wrapper
then resolves successfully even though Drizzle rolled the transaction back.

The patch retains that native error and rethrows it from the existing Payload commit API. It preserves
the initialization failure path and the rollback promise, including cleanup after a failed operation.
All Payload transactions use the corrected dependency. No application code accesses Drizzle sessions or
writes Payload records through SQL. When upgrading Payload, remove this patch only after the acceptance
commit regression tests pass against the replacement version without it.

The regression uses a deferred PostgreSQL constraint trigger, so the server rejects COMMIT after both
writes succeeded. A separate connection confirms that neither row exists and the port returns no receipt.
Server-raised `40001` failures at COMMIT cover a full retry and exhaustion after three attempts; a PostgreSQL
sequence counts attempts across rollbacks. These are deterministic injected serialization failures, not
a substitute for the concurrent-transaction tests described below.

## Caller-owned transactions

The private `bindTransactionalEmail` integration joins an active `PayloadRequest.transactionID`, including a pending
transaction promise. It does not commit, roll back, or retry that caller's transaction. The returned receipt is scoped
to the transaction. The owner must discard it on rollback and expose it only after a successful commit.

`runTransactionalEmailTransaction` supplies an outer Website integration boundary for a complete business callback.
It opens a serializable transaction, passes its request and the narrow command port to the callback, commits, and then
returns the callback result. It repeats the entire callback after a retryable conflict, at most three attempts. The
callback must perform only transaction-bound database work, propagate failures, and avoid external side effects.
This boundary rejects an already active transaction because it cannot commit another owner's work. Product commands
still import only the Payload-independent public interface; the integration functions are private Website adapters.

The pinned Payload Local API rolls back numeric request transaction IDs on operation errors even when it did not start
the transaction. The mail adapter instead supplies Payload's supported promise-valued transaction ID. Native
`initTransaction` treats that form as borrowed and `killTransaction` leaves it to its owner. Capability checks resolve
the promise before checking the exact transaction identity. No additional dependency patch changes rollback behavior.

The adapter reads only the documented Payload `db.sessions` registry to verify that an ID is active before binding and
at each guarded collection operation. This check prevents Drizzle's missing-session fallback from writing outside a
transaction. It never reads the session's database handle or calls SQL. Unknown, zero, rejected, and already closed
transaction IDs fail closed. The owner must not end the transaction while its callback is still running.

Serialization and deadlock failures become the content-free `transaction-conflict` error. Payload converts a PostgreSQL
business-key unique violation into a `ValidationError` without retaining its cause. The adapter recognizes only the
outbox collection, table, and exact composite business-key field path. The private event storage also recognizes its
exact sequence and provider-identity constraint paths. Other validation errors remain
`storage-unavailable`. After a joined conflict, the owner rolls back and retries the full business transaction; the
module never queries the winner inside the failed transaction.

`tests/integration/transactionalEmail.transactions.test.ts` uses synthetic Countries records as business mutations,
real Payload calls, and an independent PostgreSQL observer. It checks the shared commit, full rollback, pending outer
response at COMMIT, native write failures, and concurrent standalone and caller-owned requests. A barrier places both
requests after their deduplication reads before either insert. READ COMMITTED exercises the native unique-violation
translation; SERIALIZABLE exercises PostgreSQL serialization conflict. The losing owner receives a typed conflict,
rolls back, and repeats its complete mutation before obtaining the original deduplicated receipt. Deferred commit
faults prove whole-business retries and bounded exhaustion. Fetch and HTTP(S) guards forbid external mail, link, or
analytics calls throughout these transactions.

## Private persistence

`transactionalEmailOutbox` stores the accepted command, resolved address, a versioned HMAC digest of the recipient
binding and address, an independently generated UUID provider key, and acceptance state. The synthetic digest uses a
fixed non-secret test key with version `fake-v1`. A real key owner and rotation policy remain a Production decision.
`transactionalEmailEvents` stores the content-free first event with sequence one.

Both collections deny Admin and normal Local API access, including `overrideAccess`. They have no REST or GraphQL
endpoint. Internal hooks require a module-created identity registered for the exact active transaction. Closing the
transaction revokes that identity. A Boolean, a copied object shape, or an unrelated transaction does not grant access.
Provider keys and acceptance identities are immutable; event updates and generic deletion are denied.

The generated additive migration creates unique indexes for the command type plus operation reference, provider key,
outbox plus event sequence, and non-null provider event identifiers. PostgreSQL permits multiple null entries in the
last index. Existing application versions ignore the added tables; the new version requires this migration.

Provider feedback storage and its partial provider-identity index are described in
[event invariants](transactional-email-events.md).

Both collections join the `private-live` operational cache policy with `no-public-impact`. There are no public reads,
cache tags, invalidation calls, or seed records.

## Runtime limits and evidence

Local, test, and CI select fake boundaries. Preview and Production fail before command initialization because no real
adapter is installed. The shared runtime selection also gates the private worker described in [worker processing](transactional-email-worker.md). No worker,
provider, link generation, product trigger, or Dashboard consumer is activated by command acceptance.

`tests/integration/transactionalEmail.acceptance.test.ts` crosses the command port with real Payload and a disposable
Postgres database. It observes commits from a separate connection, checks rollback and bounded retries, denies normal
collection access, exercises REST exclusion and the absence of query and mutation fields in the real Payload GraphQL schema,
checks the migrated indexes, and blocks fetch and HTTP(S)
requests during local/test/CI command acceptance. Permission-matrix and cache architecture tests cover registration.

The GraphQL contract uses the real sanitized mail collections and Countries as a positive query/mutation control.
The repository-wide GraphQL schema currently fails to build on an unrelated relationship, including when both mail
collections are excluded. The test proves the mail collections are absent from a bounded real schema; it does not
claim whole-schema or GraphQL HTTP coverage. `@payloadcms/graphql` is a test dependency pinned to the Payload version.
