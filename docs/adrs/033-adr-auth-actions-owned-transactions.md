# ADR: Bounded Auth transaction-control exceptions

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.1 |
| Date | 02.10.2026 |
| Status | Approved |

## Background

The private authentication-action lifecycle requires immutable terminal state, idempotent retries and deletion 42 days after the original terminal timestamp. Inspection of the installed Payload 3.88.0 update path identified a precheck followed by an ID-only write.

Password recovery also requires concurrency-safe admission before creating an AuthAction. Unknown and ineligible addresses must count without creating an action, so admission uses separate short-lived target and IP event rows.

## Problem Description

For AuthActions, two concurrent writes can validate the same nonterminal predecessor. An ID-only write can then overwrite a committed terminal state or replace its timestamp, extending the deletion deadline. Hook validation against each request's earlier document does not prevent that stale write.

For recovery admission, two requests can both observe available quota and both write events. Atomic commit alone does not enforce the shared limit. Counting only AuthActions misses unknown targets and exposes eligibility through different limiting behavior.

## Considerations

Ordinary native transactions provide atomic commit and rollback, but unchanged isolation defaults do not prevent either race. Local API `where` filters select before the final ID-only update; versions retain history rather than provide atomic expected-state comparison. The installed Local API exposes no supported conditional-write or per-operation isolation argument. The version-bound [update implementation](https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/collections/operations/utilities/update.ts) and [transaction initializer](https://github.com/payloadcms/payload/blob/fea6f8a47a50ff1330d8a5071b43e7dcffb97b22/packages/payload/src/utilities/initTransaction.ts) substantiate these limits.

Process-local locks cannot coordinate multiple application instances. Fixed time buckets with unique keys do not express the rolling-hour quota and cooldown since the last admitted request. Global stronger isolation changes unrelated writers and their conflict handling. New lock storage or queues introduce ownership, recovery and bypass protocols. No suitable supported alternative within these bounded models and unchanged global defaults was identified.

## Decision with Rationale

Permit Auth-owned per-operation Serializable transaction control using only `payload.db.beginTransaction`, `commitTransaction` and `rollbackTransaction` for these two exceptions:

- Private AuthActions lifecycle and retention. Preserve the first terminal state and timestamp, including idempotent retries and the 42-day deletion boundary.
- Private recovery admission and event retention. Check target and IP limits, record both separate event rows and create any eligible AuthAction in one owned transaction. Each dimension permits five admitted requests per rolling hour with a five-minute cooldown. Admitted unknown and ineligible targets count; denied attempts create no events, consume no quota and extend no cooldown. Event rows contain environment-specific, versioned HMAC digests, never plaintext, a principal link or both dimensions in one row. Delete events through the existing Website scheduling owner no later than 65 minutes after observation.

This is a closed list, not a general relaxation of `src/AGENTS.md`. Any further exception needs its own justification and explicit architecture approval recorded here. Recovery approval defines a design contract, not proof of implementation or deployment.

Every data read, create, update and delete, including retention, remains Payload Local API with the owned request and hooks/access/capability enforcement. Keep target and IP events private and outside diagnostics. Reject borrowed transactions of unknown isolation. Permit no direct SQL, adapter data operations, global isolation configuration, general-purpose transaction service or extra lock table/collection.

Exclude external effects from retrying work. Serialization/deadlock conflicts retry the entire command at most three times with fresh reads and validation. Same-state terminal retries preserve the original timestamp without writing. Commit and rollback failures propagate. Exhausted retries fail closed; they cannot grant admission from an uncommitted result.

## Technical Debt

The wrappers increase coupling to the Postgres adapter's transaction controls and the repository's Drizzle transaction-error propagation patch. Recheck both when upgrading Payload. This decision grants no exception beyond the two named cases and no runtime activation authority.

## Risks

Serializable conflicts can exhaust the retry bound. Coordinated real-database tests must cover both lifecycle conflicts and recovery quota races. Source inspection, unit tests and a build do not prove database scheduling. The event-deletion deadline also requires a functioning schedule and sufficient cleanup capacity; transaction isolation alone cannot prove retention.
