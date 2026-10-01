# ADR: AuthActions-owned transactions

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 01.10.2026 |
| Status | Approved |

## Background

Designing the private authentication-action lifecycle required immutable terminal state, idempotent retries and deletion 42 days after the original terminal timestamp. Inspection of the installed Payload 3.88.0 update path identified a precheck followed by an ID-only write, motivating this concurrency decision.

## Problem Description

Two concurrent writes can validate the same nonterminal predecessor. An ID-only write can then overwrite a committed terminal state or replace its timestamp, extending the deletion deadline. Hook validation against each request's earlier document does not prevent that stale write.

## Considerations

Ordinary native transactions provide atomic commit and rollback, but unchanged isolation defaults do not guarantee stale-write protection. Local API `where` filters select before the final ID-only update; versions retain history rather than provide atomic expected-state comparison. The installed Local API exposes no supported conditional-write argument. The [version-bound update implementation](https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/collections/operations/utilities/update.ts) substantiates this limitation.

Global stronger isolation changes unrelated writers and their conflict-handling requirements. New lock storage or queues introduce additional ownership, recovery and bypass protocols. Neither is proportionate to this private lifecycle. No suitable supported alternative within the approved AuthActions schema and unchanged global defaults was identified.

## Decision with Rationale

Permit only an AuthActions-owned per-operation Serializable wrapper using `payload.db.beginTransaction`, `commitTransaction` and `rollbackTransaction` for transaction control. This is an explicit, human-approved exception for the private AuthActions lifecycle and retention, not a general relaxation of `src/AGENTS.md`.

Every data read, create, update and delete, including retention, remains Payload Local API with the owned request and hooks/access/capability enforcement. Reject borrowed transactions of unknown isolation. Permit no direct SQL, adapter data operations, global isolation configuration or extra lock table/collection.

Exclude external effects from retrying work. Serialization/deadlock conflicts retry the entire command at most three times with fresh reads and validation. Same-state terminal retries preserve the original timestamp without writing. Commit and rollback failures propagate. This confines the stronger isolation guarantee to the lifecycle that requires it.

## Technical Debt

The wrapper increases coupling to the Postgres adapter's transaction controls and the repository's Drizzle transaction-error propagation patch. Recheck both when upgrading Payload; this decision grants no exception to other modules or runtime activation authority.

## Risks

Serializable conflicts can exhaust the retry bound. Coordinated real-database concurrency tests are prepared for CI; successful execution remains pending. Source inspection, unit tests and a build do not prove database scheduling.
