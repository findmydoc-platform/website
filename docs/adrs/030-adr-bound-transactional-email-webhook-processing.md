# ADR: Bound transactional email webhook processing

## Status

| Name | Content |
| --- | --- |
| Author | Website architecture |
| Version | 1.0 |
| Date | 2026-09-27 |
| Status | Approved |
| Decision authority | Accepted issue-scoped orchestration decision for Website #1897 |

## Background

[ADR 028](028-adr-lettermint-for-transactional-email.md) requires durable, idempotent provider feedback.
[Issue #1897](https://github.com/findmydoc-platform/website/issues/1897) adds the corresponding owned Payload
transaction. The [delivery-edge contract](../engineering/transactional-email-lettermint-delivery-edge.md) gives
the webhook five seconds to respond. Payload 3.88 exposes transaction begin, commit and rollback, but no
request-scoped cancellation of an active PostgreSQL statement.

## Problem Description

A response timer alone leaves database work running. A slow query or lock can exceed the request budget, while
a delayed Payload operation can resume after the response. PostgreSQL 15 also disables `statement_timeout`
before `CommitTransactionCommand`, so transaction-local statement limits cannot cancel an in-flight commit.
A commit may succeed after the caller has already received a temporary failure.

## Considerations

- A response-only timer bounds HTTP latency but cannot prevent later operations or commit initiation.
- Global, role or session-persistent timeouts affect unrelated Payload work and are unsafe with a transaction pool.
- Separate connections, direct application-data SQL or another queue add ownership and reconciliation paths
  outside this issue. They do not remove an ambiguous result once commit has started.
- PostgreSQL 15 has no `transaction_timeout`. Even connection cancellation cannot promise rollback after the
  database has crossed its durable commit boundary.
- A private control-only bridge combines transaction-local statement limits, application deadline checks and
  the existing provider-event uniqueness boundary. It retains Payload ownership of all application data.

## Decision with Rationale

Use one absolute, monotonic five-second deadline from route entry, before awaiting route parameters. Return the existing fixed `503`
outcome when it expires. Do not keep the HTTP request waiting for storage cleanup or a commit result. A `2xx`
response still requires verified duplicate recognition or a durably committed normalized effect.

Permit one narrow exception to `src/AGENTS.md`: the private transactional-email webhook deadline adapter may
access the active Payload Postgres transaction session only to execute fixed, parameterized, transaction-local
safety controls. It must not query application tables, inspect business data, accept SQL from a caller or expose
a general database executor. All application reads and writes remain Payload Local API operations.

Before each Local API operation and immediately before commit, check the same absolute deadline and recalculate
the remaining budget. Apply `set_config('statement_timeout', value, true)` and
`set_config('idle_in_transaction_session_timeout', value, true)` on that transaction, retaining a small cleanup
reserve. Never pass zero, which disables these controls. Check the adapter/session capability and returned control
values; unsupported behavior fails closed with `503`.

The statement limit also bounds lock waits. The idle limit prevents a stalled application continuation from
holding an idle database transaction indefinitely. Connection acquisition retains the existing three-second pool
policy. These controls require no new connection, environment value, schema change or global pool configuration.

Once expiration is observed, do not start another Local API operation or commit. An operation already in progress
may settle, but its owner must roll back instead of proceeding. Do not delete the transaction session concurrently
with a still-running Local API operation: Payload may otherwise fall back to autocommit. Bound cleanup waiting
and keep failures content-free.

A commit started while budget remained may finish after the HTTP deadline. Its outcome is unknown to that caller;
the endpoint returns `503`, even if the commit later succeeds. This is an explicit result boundary, not a claim
that PostgreSQL cancels commit. Provider retry with the same durable event ID reconciles both cases:

- A late successful commit makes the identical retry a duplicate without another event or transition.
- A failed or rolled-back commit allows the retry to apply the effect once.
- A conflicting replay remains a mutation-free mismatch.

## Consequences

Timeout metrics can include transactions that later committed successfully. Reconciliation must use provider-event
identity and stored history, not infer rollback from an HTTP `503`. The transaction-local controls reduce occupied
connection time before commit; they cannot promise a bounded lifetime for an already-running commit.

Before Production activation, Preview evidence must prove control application, reset after transaction end,
statement/lock timeout behavior and both ambiguous-commit retry paths through the configured Supavisor transaction
pool. Unsupported pool behavior keeps feedback unavailable. Issue #1897 does not provision, configure or mutate
hosted services. This evidence belongs to the existing delivery-edge activation gates.

## Implementation Plan

- `src/features/transactionalEmail/webhookDeadline.ts` owns the deadline, fixed controls and bounded cleanup wait.
- `lettermintWebhook.ts` owns the HTTP timer and safe response; `providerEvents.ts` checks before each Local API
  operation; `transactions.ts` checks before transaction work and commit, then owns rollback and conflict retries.
- Keep this bridge private to transactional email. Do not export it from the feature's public entry point.
- Extend real-route/real-Payload tests in `tests/integration/transactionalEmail.webhook.test.ts`; add focused bridge
  security tests under `tests/unit/features/transactionalEmail/`.
- Update the event and delivery-edge specifications. No new dependency, migration or environment setting is needed
  for the deadline bridge.

### Verification

- [x] HTTP returns fixed `503` at the absolute deadline, including while commit is still running.
- [x] A stalled Payload continuation cannot start another operation or commit after expiration.
- [x] Statement/lock failures and expiration before commit leave application state unchanged.
- [x] Late successful and failed commits each reconcile through retry to exactly one event/effect.
- [x] Unsupported adapter capabilities and control results fail closed without arbitrary SQL execution.
- [x] Required format, static checks, build and focused tests pass; security, architecture and test reviews examine
      the ambiguous-commit evidence explicitly.
- [ ] Preview validates transaction-local behavior through Supavisor before Production activation.

## Technical Debt

The bridge depends on Payload's active Postgres transaction session and therefore needs review on Payload or
Drizzle upgrades. If Payload adds a suitable native per-operation deadline API, replace the bridge and retain
these behavior tests. A PostgreSQL upgrade alone must not remove the ambiguous-commit contract.

Rollback the code change through the normal release workflow or keep hosted mail activation disabled when control
compatibility cannot be established. Transaction-local settings disappear when their transaction ends; no persistent
database setting needs reversal. Do not silently bypass the controls to restore availability.

## Risks

Network failure can hide a durable commit. Idempotent retry is required even when no timeout was observed locally.
Process suspension and database commit internals can also delay result observation. The endpoint must never convert
those unknown outcomes into `2xx` without durable evidence. No concurrency hardening or suppression writes are added
by this decision; those remain Website #1906 and #1898.

## More Information

- [PostgreSQL 15 timeout controls](https://www.postgresql.org/docs/15/runtime-config-client.html#RUNTIME-CONFIG-CLIENT-STATEMENT)
- [PostgreSQL 15 transaction-local set_config](https://www.postgresql.org/docs/15/functions-admin.html#FUNCTIONS-ADMIN-SET)
- [PostgreSQL 15 disables statement timeout before commit](https://github.com/postgres/postgres/blob/REL_15_STABLE/src/backend/tcop/postgres.c#L2560-L2568)

ADR 028 remains unchanged. This record defines the request-budget and ambiguous-commit boundary for its delivery edge.
