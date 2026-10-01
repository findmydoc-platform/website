# ADR: AuthActions-owned transactions

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 01.10.2026 |
| Status | Approved |

## Background

[Website #1974](https://github.com/findmydoc-platform/website/issues/1974) introduces private AuthActions with immutable terminal state, idempotent retries and deletion 42 days after the original terminal timestamp. The installed Payload version is 3.88.0.

## Problem Description

Two concurrent writes can validate the same nonterminal predecessor. An ID-only write can then overwrite a committed terminal state or replace its timestamp, extending the deletion deadline. Hook validation against each request's earlier document does not prevent that stale write.

## Considerations

Ordinary native transactions provide atomic commit and rollback, but unchanged isolation defaults do not guarantee stale-write protection. Local API `where` filters select before the final ID-only update; versions retain history rather than provide atomic expected-state comparison. The installed Local API exposes no supported conditional-write argument.

Global stronger isolation changes unrelated writers and their conflict-handling requirements. New lock storage or queues introduce ownership, recovery and bypass protocols beyond this ticket. Neither is proportionate here. No suitable supported alternative within the approved AuthActions schema and unchanged global defaults was identified. The [source-backed research](../research/issue-1974-auth-action-concurrency.md) records the comparison and its limits.

## Decision with Rationale

Permit only an AuthActions-owned per-operation Serializable wrapper using `payload.db.beginTransaction`, `commitTransaction` and `rollbackTransaction` for transaction control. This is an explicit, human-approved exception for #1974, not a general relaxation of `src/AGENTS.md`.

Every data read, create, update and delete, including retention, remains Payload Local API with the owned request and hooks/access/capability enforcement. Reject borrowed transactions of unknown isolation. Permit no direct SQL, adapter data operations, global isolation configuration or extra lock table/collection.

Exclude external effects from retrying work. Serialization/deadlock conflicts retry the entire command at most three times with fresh reads and validation. Same-state terminal retries preserve the original timestamp without writing. Commit and rollback failures propagate. This confines the stronger isolation guarantee to the lifecycle that requires it.

## Technical Debt

The wrapper increases coupling to the Postgres adapter's transaction controls and the existing Drizzle commit-error propagation patch. Recheck both when upgrading Payload; this decision grants no exception to other modules or runtime activation authority.

## Risks

Serializable conflicts can exhaust the retry bound. Coordinated real-database concurrency tests are prepared for CI; successful execution remains pending. Source inspection, unit tests and a build do not prove database scheduling. See the [implemented lifecycle contract](../security/auth-actions.md).
