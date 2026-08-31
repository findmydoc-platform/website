# ADR: Database Runtime Connection Modes

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.1 |
| Date | 31.08.2026 |
| Status | Approved |

## Background

The Website, Payload REST and GraphQL APIs, Payload Admin UI, and Clinic Dashboard API requests run through Vercel
Functions. Each warm function instance can own a Postgres pool. Scanner bursts and concurrent application traffic can
therefore multiply database clients beyond the capacity of the Supabase Postgres instance even when each request
performs little database work.

Operational database work has a different shape. Payload migrations, backups, `pg_dump`, and focused database tools
run as controlled processes and need a direct Postgres session rather than a serverless transaction pool.

## Problem Description

A single connection mode for both workloads creates two failure modes:

- Direct runtime pools multiply persistent database clients across Vercel instances and can exhaust the database
  connection limit.
- Transaction pooling is unsuitable for operational tools that rely on session state or a stable direct connection.

The runtime also needs a bounded failure contract. A database connection limit or acquisition timeout must not look
like an authentication failure, must not trigger an automatic request replay, and must leave mutation input available
for an explicit user retry.

## Decision Drivers

- Keep the Website and Clinic Dashboard APIs available during ordinary serverless concurrency.
- Keep migrations, backups, and database tools off the serverless transaction pooler.
- Fail quickly and predictably when no database connection can be acquired.
- Preserve the existing Clinic Dashboard temporary-unavailability state and five-second client timeout.
- Avoid query or write replay at the Website boundary.
- Emit useful operational telemetry without database URLs, credentials, request bodies, or patient data.

## Considerations

### Direct connection for every workload

The runtime and operational tools both use a direct database URL. This is simple, but every Vercel instance can add a
new application pool to the database connection count. Rejected because serverless concurrency can exhaust the direct
connection limit.

### Session pooler for every workload

The Supabase session pooler reduces IPv4 and direct-connect constraints, but it keeps a database connection assigned
to each client session. It does not address the short-lived, horizontally scaled runtime workload as efficiently as
transaction mode. Rejected for the runtime.

### Transaction pooler for the runtime and direct connections for operations

The Vercel runtime uses the Supabase transaction pooler. Migrations, backups, and focused database tools use a separate
direct connection. Chosen because it matches the connection lifetime of each workload and keeps operational sessions
out of the runtime pool.

### Replace Payload's Postgres adapter

A stateless HTTP database layer would avoid client pools, but it would replace or bypass the supported Payload
Postgres adapter and expand the persistence boundary. Rejected because the operational cost and compatibility risk are
not justified by this incident.

## Decision with Rationale

### Connection topology

- `DATABASE_URI` is the only database URL read by application runtime code. In Vercel preview and production it must
  point to the Supabase transaction pooler on port `6543`.
- Payload's runtime pool is fixed in code at `max: 4`, `connectionTimeoutMillis: 3000`, and
  `idleTimeoutMillis: 10000`. This pool policy applies to every Payload consumer, including REST, GraphQL, Local API,
  and the Admin UI.
- `DATABASE_DIRECT_URI` is reserved for migrations, backups, and focused database tools. The guarded migration helper
  maps it to `DATABASE_URI` only inside the child migration process and removes the direct variable from that child's
  environment.
- The helper marks that child with `PAYLOAD_DATABASE_OPERATION=migration`. This process-local marker is the only path
  that bypasses the Vercel transaction-pooler port guard; it is not a persistent deployment variable.
- Local and local-Postgres CI commands may use `DATABASE_URI` when `DATABASE_DIRECT_URI` is absent. Hosted migration
  commands fail closed when the direct variable is absent.

This decision introduces no database schema migration.

### Transaction pooler compatibility

Supabase documents transaction mode as the connection mode for serverless and edge workloads and states that it does
not support prepared statements. The installed `@payloadcms/db-postgres` 3.87.1, Drizzle ORM 0.45.2, and `pg` 8.22.0
runtime path was inspected before adopting transaction mode. Payload passes the pool configuration to `pg.Pool`, and
the inspected Drizzle execution path uses unnamed query configurations unless application code explicitly creates a
named prepared query. The repository has no such explicit named prepared queries.

No additional adapter option is therefore required for the locked versions. This compatibility finding must be
rechecked when Payload, Drizzle, or `pg` changes. Application code must not introduce named prepared statements on the
transaction-pooled runtime connection.

### Availability and retry contract

For programmatic API consumers, database connection limits, connection acquisition timeouts, and unavailable
connection states use the stable response code `DATABASE_TEMPORARILY_UNAVAILABLE`. REST returns HTTP `503`. GraphQL
returns the code and `statusCode: 503` in the formatted error extensions; an initialization failure before Payload can
run its Root `afterError` hook returns the same GraphQL error with HTTP `503`. Other application and authentication
errors retain their native behavior.

Payload Admin uses the same bounded runtime pool but keeps Payload's native initialization-error behavior. The Website
does not add an Admin route wrapper or replace the Admin error page.

The Website does not automatically retry or replay the request. A read can be retried manually. A write keeps its
input in the calling UI and requires an explicit user action before resubmission. This avoids duplicate mutations when
the server cannot prove whether an interrupted write committed.

The Clinic Dashboard already treats a Website `503` as temporarily unavailable and uses a five-second upstream
timeout. A database outage therefore does not clear a valid clinic session or present itself as a login failure.

### Observability

The Website emits the structured event `database.runtime.connection_unavailable` and reports a sanitized exception to
PostHog. The event includes the failure kind, connection mode, and request phase. It does not include database URLs,
credentials, SQL, request bodies, authorization data, or the original database error message.

### Release gate

The repository now requires `DATABASE_DIRECT_URI` for hosted migration commands. The existing Vercel build invokes
`pnpm run ci`, so preview and production deployments fail closed until approved release automation supplies the direct
connection only to the migration process.

The direct URL must not be added to the Vercel runtime environment or forwarded as a Vercel build variable. The
smallest safe follow-up is an explicitly approved, environment-scoped GitHub migration step before deployment, followed
by a build-only Vercel command. Preview validates that release wiring first; production remains a separate gate.

## Consequences

- **Positive:** Runtime connection pressure is bounded per Vercel instance and absorbed through the transaction
  pooler.
- **Positive:** Operational tools keep direct-session behavior without exposing the direct URL to application runtime
  code.
- **Positive:** Database overload is distinguishable from auth and application errors in API responses and telemetry.
- **Negative:** `max: 4` is per function instance, not a global cap. Vercel concurrency can still multiply the total
  number of pooler clients.
- **Negative:** Payload currently reserves a pool client for adapter connection monitoring, leaving fewer clients for
  concurrent queries within an instance.
- **Negative:** Transaction mode prohibits named prepared statements and other session-dependent behavior.
- **Negative:** Hosted releases remain blocked until the separately approved migration-before-deploy wiring exists.
- **Neutral:** The three pool values are intentionally fixed in code for the first rollout and can be revisited with
  production evidence.

## Relationship to Existing Decisions

- This ADR adds a database reliability boundary to the Clinic Dashboard BFF defined in
  [ADR 026](./026-adr-standalone-clinic-dashboard-bff-architecture.md).
- Database failure telemetry follows the structured logging policy in
  [ADR 010](./010-structured-logging-approach.md).
- Migration generation and quality gates remain governed by
  [ADR 020](./020-adr-database-migration-quality-gate.md).

## References

- [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Database Runtime Connections](../engineering/database-runtime-connections.md)

## Superseded by

Not superseded.
