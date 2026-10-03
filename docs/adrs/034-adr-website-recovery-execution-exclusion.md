# ADR: Bounded Website recovery execution exclusion

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 04.10.2026 |
| Status | Draft |

## Background

Website password recovery confirms a private AuthAction, verifies the current Payload principal and Supabase identity,
then updates the password before completing the action and revoking refresh sessions. Signed browser receipts preserve
known password, lifecycle and logout success for explicit retries. Payload owns action data; Supabase owns passwords
and sessions. The two systems do not share a transaction.

[ADR 033](./033-adr-auth-actions-owned-transactions.md) permits two closed exceptions for owned Serializable Auth
transactions. Neither exception covers execution exclusion around an external provider call. This record adds one
separately justified exception; it does not revise ADR 033 or authorize broader database access. The human explicitly
approved the bounded security correction on 4 October 2026 for [Website #1994](https://github.com/findmydoc-platform/website/issues/1994).

## Problem Description

Concurrent completion requests can both read a confirmed action before either password update finishes. Separate
Serializable action reads and transitions cannot exclude an external effect between their transactions. Retrying a
transaction that contains the password call can repeat that effect. A process-local mutex cannot coordinate separate
Vercel instances.

## Considerations

Native Payload transactions remain appropriate for action data, but they expose no execution lock that remains held
across separately owned lifecycle commands and an external provider operation. Row locks or durable claims would need
new data-access or lifecycle semantics. A lock collection, queue or additional infrastructure expands storage and
recovery ownership beyond this correction. Completing the action before the password changes records success too soon.

A session-level advisory lock is incompatible with the transaction pooler required by
[ADR 027](./027-adr-database-runtime-connection-modes.md). PostgreSQL transaction-level locks bind to the current
transaction and are released by commit or rollback. A try-lock returns immediately when another transaction owns it.
This coordinates instances sharing the existing database without adding persistent data.

Supabase `updated_at` is general user metadata, not a strictly increasing password revision. Binding a grant to that
timestamp cannot establish durable exactly-once execution. A new provider metadata claim would introduce a separate
mutation and recovery protocol. Neither is part of this exception.

## Decision with Rationale

Permit the Auth-owned Website recovery completion adapter to reserve one connection from the existing Payload runtime
pool and execute only `BEGIN`, `SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired`, `COMMIT` and `ROLLBACK` on it.
The key is a purpose-separated SHA-256 digest of environment and AuthAction ID, truncated to a signed 64-bit integer.
Hash collisions can conservatively reject unrelated work; they cannot grant another action's authority.

Acquire the transaction-scoped lock before current authority reads and hold it through the password update, guarded
action completion, global sign-out and local cookie cleanup. A competing request returns the existing safe temporary
503 response without invoking the password provider. Every retry rechecks current authority after acquisition. All
Payload reads and writes remain guarded Local API operations on their independently owned requests. The reserved
connection performs no data query or mutation and is never registered as a borrowed lifecycle transaction.

Connection acquisition is bounded to three seconds, each control statement to one second and the whole reserved
execution to thirty seconds. The adapter observes connection error/end events, aborts provider requests on loss or
deadline, and checks ownership between awaited operations before starting another effect. It never automatically
replays the callback or provider operation. Healthy failures roll back; uncertain control/query failures destroy the
connection rather than return an open transaction to the pool. A connection arriving after acquisition timeout is
destroyed without running work. Cleanup failures propagate as temporary unavailability and preserve available signed
receipts. No SQL settings, named prepared statements, new pool, table, collection, migration or environment variable.

This is a closed Auth-only exception to the no-direct-SQL rule. It does not permit adapter data operations, locks for
other flows, session-wide locks or a general transaction service. Existing identity, action state, principal, email,
environment, CSRF and expiry checks remain required. Preview and Production activation remain separate gates.

## Technical Debt

The adapter depends on the installed Payload Postgres pool and node-postgres connection lifecycle. Recheck their
contracts and transaction-pooler behavior on upgrades. The fixed execution deadline and extra checked-out connection
reduce capacity within the existing four-connection runtime pool. Exhaustion returns temporary unavailability; this
decision does not raise pool limits.

## Risks

The lock excludes competing effects while the transaction remains healthy. It is not a distributed exactly-once
protocol. Connection loss can release a lock while an already-issued provider request has an uncertain outcome.
Aborting transport cannot retract a provider operation already committed. A successful password update followed by
failed lifecycle completion leaves the action nonterminal; its holder's signed receipt skips the known password
operation, but a copied older grant does not contain that receipt. No persistent provider execution claim is added.
Current authority checks, terminal action rejection and explicit retries bound these cases without proving global
exactly-once behavior. Already-issued access JWTs retain their normal expiry after refresh-session revocation.

Offline HTTP tests can verify exclusion decisions, bounded failures, cancellation and receipt preservation with
synthetic database/provider boundaries. They do not prove PostgreSQL scheduling, pooler cleanup or hosted behavior.
The coordinated real-database proof remains a separate validation obligation. This ADR grants no live configuration,
mail, deployment, migration, release or activation authority.

## References

- [PostgreSQL 15 advisory locks](https://www.postgresql.org/docs/15/explicit-locking.html#ADVISORY-LOCKS)
- [PostgreSQL 15 advisory lock functions](https://www.postgresql.org/docs/15/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [node-postgres pool acquisition and client release](https://node-postgres.com/apis/pool)
- [Supabase database connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Auth password update](https://github.com/supabase/auth/blob/v2.197.0/internal/api/user.go)
- [Pop timestamp update behavior](https://github.com/gobuffalo/pop/blob/v6.1.1/executors.go)
- [Website #1994](https://github.com/findmydoc-platform/website/issues/1994)
