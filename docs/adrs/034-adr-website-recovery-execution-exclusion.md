# ADR: Bounded Website recovery execution exclusion

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 04.10.2026 |
| Status | Approved |

## Background

Website password recovery confirms a private AuthAction, verifies the current Payload principal and Supabase identity,
then updates the password before completing the action and revoking refresh sessions. Signed browser receipts preserve
known password, lifecycle and logout success for explicit retries. Payload owns action data; Supabase owns passwords
and sessions. The two systems do not share a transaction.

[ADR 033](./033-adr-auth-actions-owned-transactions.md) permits two closed exceptions for owned Serializable Auth
transactions. Neither exception covers execution exclusion around an external provider call. This record adds one
separately justified exception; it does not revise ADR 033 or authorize broader database access.

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
timestamp cannot establish a durable execution claim. Atomically changing the password and app metadata through the
Admin API would bypass the ordinary endpoint's MFA, reauthentication, current-password and SSO checks. A fresh user
lookup cannot reproduce those policies. Keep the ordinary session password endpoint and add a narrowly scoped,
server-written progress marker before its one permitted attempt instead.

## Decision with Rationale

Permit the Auth-owned Website recovery completion adapter to reserve one connection from the existing Payload runtime
pool and execute only `BEGIN`, `SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired`, `COMMIT` and `ROLLBACK` on it.
The first key is a purpose-separated SHA-256 digest of environment and AuthAction ID, truncated to a signed 64-bit integer.
Acquire a second purpose-separated environment/subject key on the same connection to serialize distinct actions for
one identity. Both are nonwaiting transaction-scoped locks; no second connection or lock service is added.
Hash collisions can conservatively reject unrelated work; they cannot grant another action's authority.

Acquire both locks before current authority reads and hold them through confirmation or completion, the password update, guarded
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

### Durable provider progress

Use one reserved `findmydoc_recovery_progress_v1_<environment>` app-metadata field. It contains only an opaque,
purpose-separated HMAC of the authoritative environment, flow, action, subject and original action expiry, that fixed
expiry, a bounded attempt counter from zero to 100, and `ready`, `started` or `password-updated`. No sensitive IDs,
recipient information, credentials, password material, tokens or journal history are stored. Current and retained
recovery keys validate the HMAC without new configuration. The marker alone grants no authority.

Only send the reserved top-level field to the supported Admin metadata API. Do not send copied app metadata, roles,
user metadata or a password through that API. GoTrue merges top-level app metadata and writes it in its own transaction.
Read the current user again through the server Admin API with `no-store`; browser JWT claims and the PUT response alone
cannot establish persisted progress. Keep fresh ordinary `getUser()` checks before password execution and logout.

Confirmation takes a non-idempotent owned Payload `active` to `confirmed` claim before initializing `ready`. Only its
winner may issue that initialization PUT. Under the subject fence, the same guarded Local API command rejects a newer
live action and revokes older live pending/active actions. An older confirmed claim is replaceable only when the fresh
marker matches that exact predecessor in `ready`. Each initialization and next-attempt ready PUT has one eligible
writer, so this read establishes that specific write's commit. The subject guard and authority checkpoints then prevent
the old request from starting later work. A signed initializing receipt
can observe a completed initialization, but never replay an uncertain PUT. A missing or foreign marker cannot restore
a previously initialized grant. Confirmation does not consume the recovery token again on its signed technical retry.

A lost Payload claim-commit acknowledgement is reconciled inside the same guarded invocation. It read `active` while
holding both locks and has not issued a metadata PUT. If a fresh guarded Local API read now returns `confirmed` under
those continuously held locks, that record proves this invocation's claim committed. Initialize once without replaying
the command. A rolled-back claim remains active and permits a token-free technical retry. If execution ownership is
also lost, that proof is unavailable; no later browser flag, timestamp or fresh read alone can recreate the owner.

Only a matching `ready` marker and signed attempt version permit the current request to persist `started` and confirm
it through a fresh read. An existing `started` never grants another request that permission. Exactly one ordinary
`updateUser({ password })` follows. Preserve its known success immediately in a signed receipt, then persist and freshly
verify `password-updated`. Both that receipt and matching current success progress skip password execution and permit
only the still-authorized lifecycle, logout and cleanup steps. Copied original grants cannot change the password after
known success, including when Payload completion or success-marker persistence fails. Skip a redundant success PUT
when the fresh marker already records matching success.

Only provider status 422 with `weak_password` or `same_password` permits a new attempt. The inspected GoTrue handlers
reject both before password persistence. Write `ready` with the next counter and freshly verify it before issuing the
new signed attempt grant; older grants cannot upgrade themselves. An uncertain reset does not publish a new attempt
grant. Generic 4xx, 503, transport, abort or malformed results do not release execution. No retry renews action or
browser expiry. The normal endpoint retains its provider policies and current session; stateless global logout remains
a separate retryable step, with a signed success receipt before local cookie cleanup.

## Technical Debt

The adapter depends on the installed Payload Postgres pool and node-postgres connection lifecycle. Recheck their
contracts and transaction-pooler behavior on upgrades. The fixed execution deadline and extra checked-out connection
reduce capacity within the existing four-connection runtime pool. Exhaustion returns temporary unavailability; this
decision does not raise pool limits.

## Risks

The lock and durable started marker prevent a copied grant from authorizing a second password attempt. They are not a
distributed exactly-once protocol. Connection loss can release a lock while an already-issued provider request has an
uncertain outcome. Aborting transport cannot retract an operation already committed. An unresolved `started` blocks
all new recovery attempts for that subject/environment, even after its expiry; expiry does not prove that an in-flight
provider operation stopped. A newer recovery cannot silently overwrite it. Reconciliation requires trustworthy outcome
evidence or explicit operational investigation, not an automatic reset. This deliberately favors no duplicate mutation
over availability after an ambiguous result. Known successful work remains retryable through signed receipts.

Confirmed Website recovery claims remain nonterminal across expiry and sweep unless completed, replaced with the
specific ready proof above, or operationally resolved. Correlation cleanup remains unchanged. This preserves an
unresolved initialization/reset writer even when the marker is absent. A delayed old started/success PUT does not
authorize a new action. That action's retained confirmed claim prevents a third recovery from replacing the foreign
marker. A lost transport or fresh read alone never proves that an arbitrary old PUT stopped. Unresolved lifecycle
records can outlive the ordinary terminal retention interval; the 42-day terminal deletion clock starts only after
resolution. This availability and retention cost is part of the decision, not a new automatic reconciliation flow.

The Admin metadata API has no compare-and-swap. The subject fence coordinates Website recovery writers, not unrelated
administrative changes. Send only the reserved field and recheck current authoritative identity after writes; this is
not a general concurrency guarantee for other provider metadata writers. Already-issued access JWTs retain their normal
expiry after refresh-session revocation.

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
- [Supabase Admin metadata update](https://github.com/supabase/auth/blob/v2.197.0/internal/api/admin.go)
- [Supabase metadata merge and password/session persistence](https://github.com/supabase/auth/blob/v2.197.0/internal/models/user.go)
- [Supabase password strength rejection](https://github.com/supabase/auth/blob/v2.197.0/internal/api/password.go)
- [Pop timestamp update behavior](https://github.com/gobuffalo/pop/blob/v6.1.1/executors.go)
- [Website #1994](https://github.com/findmydoc-platform/website/issues/1994)
