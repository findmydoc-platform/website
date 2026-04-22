# ADR: Payload Virtual Fields Pilot for Post Author Projection

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 21.04.2026 |
| Status | accepted |

## Background

The repository already exposes `posts.populatedAuthors` as a safe author projection for public and frontend reads.
Until now, that projection has been modeled as a persisted array plus a collection-level `afterRead` hook.

This created a poor fit for the actual behavior:

- the source of truth is still `posts.authors`
- `populatedAuthors` is read-only display data
- the projected author objects are not used for filtering, sorting, indexing, or access control
- the persisted storage adds schema and migration surface without adding domain value

Issue `#891` exists to validate one low-risk Payload virtual-field pilot before considering broader adoption.

## Problem Description

We need a repository-grounded example of when Payload virtual fields reduce complexity without changing public behavior.

If we keep `populatedAuthors` persisted, we continue carrying storage tables and schema churn for a field that is only derived at read-time.
If we switch the wrong field first, we risk conflating a virtual-field experiment with unrelated concerns such as slug generation, sorting, or admin search behavior.

## Considerations

1. Keep `posts.populatedAuthors` persisted and continue mutating it in a collection `afterRead`
   - Pros: no schema change, no migration
   - Cons: keeps unnecessary storage and does not test the native virtual-field capability

2. Pilot `doctors.fullName` first
   - Pros: simple computation from sibling fields
   - Cons: `fullName` is coupled to slug generation, admin titles, query shapes, and multiple downstream consumers

3. Pilot `posts.populatedAuthors` as a virtual field (chosen)
   - Pros: clearly display-only, existing public shape is already explicit, and current consumers can stay unchanged
   - Cons: still requires one schema migration because the old persisted array already exists in Postgres

## Decision with Rationale

We use `posts.populatedAuthors` as the first Payload virtual-field pilot in this repository.

The field remains publicly available with the same shape:

- `id`
- `name`
- `avatar`

The persisted source of truth remains `posts.authors`.
`populatedAuthors` becomes a virtual array field computed through a field-level `afterRead` hook.

This keeps the current API contract intact while removing storage that only existed to support read-time projection.

We explicitly do not use this pilot to:

- redesign the author model
- change frontend consumers
- change GraphQL behavior beyond preserving the existing field shape
- validate sorting or filtering on virtual fields

## Technical Debt

The virtual field still performs per-author lookups and media resolution during reads.
That cost already existed in the old hook-based implementation and is intentionally preserved in this pilot so that the experiment isolates schema/storage complexity, not read-path optimization.

## Risks (Optional)

- If a query selects `populatedAuthors` but not `authors`, the field must still recover the relation data.
  - Mitigation: keep the fallback post lookup with recursion protection in `req.context`.
- Virtual fields cannot serve as a basis for database sorting.
  - Mitigation: this pilot is restricted to a field that is not used for sorting, filtering, indexing, or access control.
- Removing persisted storage could surprise future readers if the docs still describe `populatedAuthors` as cached data.
  - Mitigation: update ADR index, data model docs, and media-resolution docs in the same change.

## Exit Criteria for Replacement

This ADR should be revisited if at least one of the following becomes true:

- `populatedAuthors` starts driving filtering, sorting, indexing, or access behavior
- the author projection needs a different public shape
- a later virtual-field pilot shows that this repository should prefer a different pattern for derived display data

## Superseded by (Optional)

Not superseded.
