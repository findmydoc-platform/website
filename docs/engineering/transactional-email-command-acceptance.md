# Transactional email command acceptance

[Website #1852](https://github.com/findmydoc-platform/website/issues/1852) implements standalone command acceptance from
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
before both initial acceptance and duplicate receipts. The module owns a serializable read-write transaction, writes
one outbox record and its first event, and returns only after commit. A duplicate preserves the original record,
acceptance time, recipient binding, provider key, and event history. Serialization failures retry the whole transaction
up to three times. An active caller transaction is rejected; joining it belongs to Website #1853.

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

Both collections join the `private-live` operational cache policy with `no-public-impact`. There are no public reads,
cache tags, invalidation calls, or seed records.

## Runtime limits and evidence

Local, test, and CI select fake boundaries. Preview and Production fail before command initialization because no real
adapter is installed. The shared runtime selection is also the gate for subsequent worker integration. No worker,
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
