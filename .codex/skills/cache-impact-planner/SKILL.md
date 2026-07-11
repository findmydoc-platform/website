---
name: cache-impact-planner
description: Classify cache impact before planning or implementing a collection, global, public page, route, server-data loader, hook, sitemap, discovery flow, or seed flow. Use it when a change could affect public freshness, cache tags, invalidation, or the public/private data boundary.
---

# Cache Impact Planner

## Overview

Use this workflow before an implementation plan makes cache or revalidation decisions. It converts a proposed data or public-surface change into one explicit cache-impact decision without inventing architecture locally.

## Workflow

1. Read the repository root and closest path-local `AGENTS.md` files.
2. Locate and read the accepted cache ADR, runtime guide, policy catalog, planner/executor boundary, and the touched source area. Treat those local sources as the architecture contract.
3. Map the changed source to public reads, public outputs, hooks or write events, aggregate/list/sitemap/discovery dependencies, and private or request-bound inputs.
4. Choose exactly one decision:
   - `no-public-impact`: no public cache or revalidation wiring
   - `public-live`: deliberately uncached public data; private, draft, preview, and request-bound data stays live
   - `public-cached`: existing cache class, policy entry, canonical read tags, invalidation owner, normalized planner event, and focused tests are required
5. For `public-cached`, prove read/write symmetry: identify the cache key and tags, the source event, old and new identities or relations, planner output, bounded path fanout, and the tests that cover the boundary.
6. For a new collection or global, require an explicit policy-catalog classification even for `no-public-impact` or `public-live`. Static pages do not need a catalog entry.
7. Record the decision in the plan or PR notes. Keep only local implementation mechanics autonomous when existing vocabulary and boundaries already fit.

## Output Contract

Return these sections before an implementation plan is finalized:

- `Decision`: one of the three cache-impact outcomes and why it applies.
- `Dependency map`: public reads, rendered or discovery surfaces, write events, and excluded private/request-bound inputs.
- `Read/write symmetry`: cache class, policy entry, read tags, normalized event, owner, planner outcome, and bounded paths when cached.
- `Tests`: focused contract, hook, loader, route, sitemap/discovery, or seed coverage needed for the decision.
- `Stop conditions`: any architecture decision that cannot be made locally.

## Stop Conditions

Stop and request an ADR or explicit work order when the change needs a new cache class, tag family, owner type, freshness expectation, route family, Redis or remote cache, custom cache handler, `cacheComponents`, `'use cache'`, `cacheTag`, `cacheLife`, or changed invalidation semantics.
