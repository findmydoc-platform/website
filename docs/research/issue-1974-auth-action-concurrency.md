# Issue 1974: AuthAction concurrency

Research on 1 October 2026 supporting [Website #1974][issue]. The human-approved [ADR 033](../adrs/033-adr-auth-actions-owned-transactions.md) records the narrowly scoped decision supported by this evidence.

## Evidence and scope

The installed `payload` and `@payloadcms/db-postgres` versions are 3.88.0. Release source links below use commit `fea6f8a47a50ff1330d8a5071b43e7dcffb97b22`. The installed Drizzle transaction implementation also includes the repository's [commit-error propagation patch][patch], so unpatched release code alone does not describe its failure behavior.

#1974 requires terminal immutability, documented idempotent retries, and hard deletion 42 days after the original terminal timestamp. Its exact transition matrix remains a recorded INVEST finding. The following witness needs any permitted nonterminal-to-terminal transition, without choosing a new product rule. Call its states `S` and `T`.

This is a counterexample to relying on hook checks and default-isolation updates, rather than an observed production failure.

1. Requests A and B start independent updates and both retrieve the same action in `S`, with no terminal timestamp.
2. Both collection hooks validate their own original document and prepare `T`. A assigns terminal time `t1`; B assigns `t2`, where `t2 > t1`.
3. A writes and commits `T, t1`.
4. B writes by the same ID and commits `T, t2`. Its original document still says `S`. The first terminal time is lost, and deletion moves from `t1 + 42 days` to `t2 + 42 days`.

This is a concrete lost-update and retry-idempotency failure. A competing different transition can also overwrite an already committed terminal state if both transitions were allowed from the old `S`; that case depends on the final transition matrix. The immutable numeric ID is unchanged by either race. There are no mail sends, callback consumption, principal activation, or other external effects in #1974, so those future risks do not justify a larger transaction here. [Issue contract][issue], [update retrieval][update-op], [hook and final write][update-doc].

## What Payload provides

Payload already starts transactions for supported data-changing operations and shares one through `req.transactionID`. Thus the problem is isolation between requests, not an absence of transactions. The exported `initTransaction(req)` starts one without per-call options; `commitTransaction(req)` and `killTransaction(req)` manage its end. `killTransaction` also swallows rollback errors. [Official transaction documentation][transactions], [native utilities][init], [rollback utility][kill].

The bulk Local API `where` query selects documents before their hooks run. The final write calls `updateOne` with the ID and no original state predicate. The Postgres implementation ultimately updates by ID. Adding `state`, `updatedAt`, or a custom revision to the earlier filter does not create atomic compare-and-set. Local update types expose no expected-version or conditional-write argument; versions save history after writing the main document. [Local update contract][local-update], [update retrieval][update-op], [final write][update-doc], [Postgres write][upsert], [versions documentation][versions].

The repository omits `transactionOptions` in [Payload config][config]. The Postgres adapter supports a global `PgTransactionConfig`, and its transaction starter accepts per-call options. Without an override it uses adapter defaults, then database defaults. PostgreSQL's default is Read Committed: concurrent writers may wait, then apply their ID-only update to the current row. The actual server/session default was not queried. An application invariant therefore needs an explicit guarantee rather than assuming an environment default. Repeatable Read rejects competing updates to the same row, but can allow write skew across different rows; Serializable also excludes those serialization anomalies. Both require whole-transaction retries. [Postgres configuration][postgres], [transaction starter][begin], [PostgreSQL isolation][isolation].

## Alternatives

| Option | Atomicity and concurrency | Access, hooks, scope and coupling | Failure and maintenance |
| --- | --- | --- | --- |
| Native helpers at current defaults | Atomic commit/rollback, but no fixed stale-read protection. | Local API and hooks preserved; no direct adapter calls. | A retry can repeat a lost update. Insufficient. |
| Global Serializable plus native helpers | Sufficient isolation when all reads and writes share the transaction. | Changes defaults for 45 explicitly configured collections and four globals, plus plugin/internal collections. Explicit per-call overrides remain separate. | Adds conflict handling requirements to unrelated writers, including ones with no bounded retries. Operational cost is unmeasured; disproportionate scope. |
| Per-operation Repeatable Read or Serializable | Same-row conflict detection; Serializable also covers decisions involving multiple records. | All data operations stay in Local API with access/hooks intact. Only transaction start/commit/rollback use the documented `payload.db` methods. | Bounded full retries, propagated commit failure, explicit rollback. Narrow exception; existing repository pattern. |
| Native conditional update or versions | No supported Local API CAS identified in 3.88.0; history does not reject stale writes. | Adding a revision filter still loses it at the final write. Versions add storage and retention work. | Insufficient without another concurrency mechanism. |
| Existing native locks or unique claims | Admin locks check an editor lease, rather than atomically claiming a system command. A unique claim can serialize a transaction only if its acquisition protocol is sound. | Existing `InquiryCommandLocks` belongs to the inquiry aggregate. Reusing it broadens that domain; AuthActions has no dedicated claim field or constraint. | Not a suitable existing Auth abstraction. New claim storage or globalizing the inquiry lock exceeds this ticket. |
| Empty Local API update as a row lock | A physical update would hold a database row lock, but an empty update is not a safe neutral touch. | Payload fills absent fields from the pre-lock original document, including lifecycle state. Hooks run before acquisition. | Can overwrite terminal data before a fresh read. A pruning/validation bypass would create a special internal protocol to maintain. Reject. |
| Append-only transitions | Appending preserves entries, but does not alone validate the predecessor or reject a post-terminal transition. | Changes the approved mutable lifecycle contract, state projection and retention model. | Requires a new consistency design. Reject for #1974. |
| Queue or in-process mutex | A process mutex protects only one instance. A queue works only if every writer, including retention, shares durable exclusive ownership. | No existing Auth queue/ownership protocol was identified; another scheduler or lock store enlarges scope. | Crashes, overlapping instances and bypass writers need recovery/fencing. Reject for this ticket. |

Sources for lock/claim comparison: [document locking][locks], [installed lock check][lock-check], [inquiry claim][inquiry-claim], [inquiry lock collection][inquiry-lock]. For the empty-update comparison, [field fallback][fallback] restores previous values before the final write. A focused, database-free probe of the installed `beforeValidate` function confirmed that `{}` becomes `{ state: 'active', terminalAt: null }` for those two fields. Pruning them later would also need special handling of subsequent required-field validation. [Validation sequence][update-doc], [field validation][field-validation].

## Accepted decision and proof still needed

No suitable supported alternative was identified within the current schema, unchanged global configuration, and strict ban on application adapter calls. The root orchestrator accepted a narrowly owned AuthAction transaction wrapper using only `payload.db.beginTransaction`, `commitTransaction`, and `rollbackTransaction` for control, with explicit Serializable isolation. The human authorized this fallback conditionally, "Wenn es nicht anders gut geht, dann gerne auch." The research ruled out the suitable native alternatives within #1974 before the orchestrator accepted that condition. Existing [review transactions][review-tx] and [mail transactions][mail-tx] establish this pattern, but their domain-specific errors/capabilities do not become Auth dependencies.

The exception applies only to #1974's private AuthAction lifecycle and retention. All reads and mutations use Payload Local API with the same owned request, hooks and access enforcement. It does not permit adapter data methods, direct SQL, a global isolation change, a lock collection, shared transaction infrastructure or a product-flow integration. It changes no instruction files. The [AuthAction contract](../security/auth-actions.md) records the implemented transition and diagnostic rules that resolve the two INVEST findings.

The wrapper should own a fresh request, reject borrowed transactions of unknown isolation, pass that request through every Local API read/write/delete, re-read and validate on every bounded retry, and return only after commit. Same-state terminal retries return the existing record without updating it; retention always checks the persisted original terminal time. Only recognized serialization/deadlock conflicts retry. No external effects belong inside the retrying work. Bulk update APIs return per-document errors, which can obscure the underlying conflict; use the single-ID path and preserve error causes. The existing commit patch is part of the required runtime. [Update error handling][update-op], [existing commit/retry contract][mail-contract].

Source inspection proves the operation structure; the focused probe proves field fallback only. Neither proves database scheduling. The CI integration contract coordinates two transactions through the real Auth service and Local API, covering concurrent terminalization, original terminal time, terminal-state conflict, and retention deletion/retry. No local database, integration or E2E tests were executed. Database scheduling remains unverified until CI supplies that evidence. The optional integration lane is not a substitute for the required merge gates.

[issue]: https://github.com/findmydoc-platform/website/issues/1974
[patch]: ../../patches/@payloadcms__drizzle@3.88.0.patch
[config]: ../../src/payload.config.ts
[update-op]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/collections/operations/update.ts
[update-doc]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/collections/operations/utilities/update.ts
[local-update]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/collections/operations/local/update.ts
[upsert]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/drizzle/src/upsertRow/index.ts
[transactions]: https://payloadcms.com/docs/database/transactions
[init]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/utilities/initTransaction.ts
[kill]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/utilities/killTransaction.ts
[postgres]: https://payloadcms.com/docs/database/postgres
[begin]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/drizzle/src/transactions/beginTransaction.ts
[isolation]: https://www.postgresql.org/docs/18/transaction-iso.html
[versions]: https://payloadcms.com/docs/versions/overview
[locks]: https://payloadcms.com/docs/admin/locked-documents
[lock-check]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/utilities/checkDocumentLockStatus.ts
[inquiry-claim]: ../../src/features/inquiryAggregate/commandLock.ts
[inquiry-lock]: ../../src/collections/InquiryCommandLocks.ts
[fallback]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/fields/hooks/beforeValidate/promise.ts
[field-validation]: https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/fields/hooks/beforeChange/promise.ts
[review-tx]: ../../src/collections/reviews/commandTransaction.ts
[mail-tx]: ../../src/features/transactionalEmail/transactions.ts
[mail-contract]: ../engineering/transactional-email-command-acceptance.md
