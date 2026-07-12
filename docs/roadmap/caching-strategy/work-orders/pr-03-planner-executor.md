# PR 3 Work Order: Revalidation Planner And Executor

This work order defines the future PR 3 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 3 and does not change runtime behavior.

## Summary

PR 3 introduces the central revalidation planner and executor boundary that later PRs use to turn normalized cache events into tags, paths, execution results, and redacted operational logs.

- Branch: `feature/cache-revalidation/03-planner-executor`
- PR title: `refactor(hooks): add cache stack 3/8 revalidation planner`
- Base branch: `feature/cache-revalidation/02-policy-map`
- Dependency: PR 2 is implemented, validated, reviewer-clean, and based on the accepted PR 1 plan.
- Scope type: boundary-only runtime code preparation.

The implementation must not ask the executor to decide cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [Public Cache And Revalidation Implementation Plan](../cache-revalidation-implementation-plan.md)
- [PR 2 Work Order: Cache Policy Map](./pr-02-policy-map.md)
- Future PR 2 `src/utilities/cachePolicy/**` implementation output
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)

## Objective

Add a central revalidation planner and executor module that turns PR 2 policy-map contracts into serializable, testable revalidation plans.

The planner must be pure. It maps normalized events to deduped tags, paths, cache classes, surface IDs, and redacted log metadata. The executor performs the runtime side effects in a controlled boundary, attempts all planned work best-effort, and returns structured execution results.

PR 3 prepares the runtime boundary for PR 4 core hook migration. It does not migrate existing hooks, routes, sitemaps, seed flows, media hooks, cache helpers, or `unstable_cache` call sites.

## Non-Goals

PR 3 must not:

- route collection hooks, global hooks, redirect hooks, routes, sitemap routes, seed flows, media hooks, or cache helpers through the planner
- change existing calls to `revalidateTag` or `revalidatePath` outside new executor tests and the new executor module
- change `unstable_cache` usage
- alter route `dynamic`, `revalidate`, `force-static`, or `force-dynamic` behavior
- replace existing runtime tag strings in hooks or helpers
- add legacy dual-tagging for `global_header`, `global_footer`, `global_landingPages`, `global_cookieConsent`, `pages-sitemap`, `posts-sitemap`, `redirects`, or `${collection}_${slug}`
- repair, remove, or rewire `getCachedDocument`
- implement clinic/listing, discovery, seed/bulk, direct media dependency, or observability UI behavior
- add Redis, a custom cache handler, remote cache storage, locks, dedupe, or runtime cache persistence
- change ADR 023, the PR 1 implementation plan, or the PR 2 policy-map contract

## Fixed Decisions

PR 3 uses these decisions without reopening them:

- Module location: `src/utilities/cacheRevalidation/**`
- Planner input: normalized event objects, not raw Payload hook args, raw Payload docs, request objects, or route modules.
- Planner boundary: strictly pure.
- Executor boundary: the executor is the only PR 3 module that may import `next/cache`.
- Execution order: tags first, then paths.
- Execution behavior: best-effort; attempt all planned tags and paths, log failures, and return a summary result without breaking CMS writes.
- Runtime scope: boundary-only.
- `disableRevalidate` handling: caller or hook-adapter responsibility. The planner and executor do not consume Payload `context`.
- Unknown public-cache behavior: fail fast unless the event is explicitly modeled as private-live/no-op or a typed deferred case.
- Redirect handling: supported only if PR 2 exposes canonical redirect policy support. Otherwise PR 3 must stop instead of inventing redirect tags locally.
- Logging: operational structured logs only. No PostHog business events.

The executable planner coverage is limited to PR 4 core surfaces:

- Pages
- Posts
- Header
- Footer
- LandingPages
- CookieConsent
- Redirects, only when PR 2 provides a canonical redirect policy entry

The following areas remain explicit deferred cases for later PRs:

- clinic detail and Listing Comparison surfaces for PR 6
- related clinic-visible collections for PR 6
- sitemap, public discovery, and `llms.txt` behavior for PR 7
- seed and bulk final flush behavior for PR 7
- direct media dependency resolution as a bounded follow-up
- dashboard or inspector visibility for PR 8

## Expected Implementation Shape

The implementation should create a small runtime module under `src/utilities/cacheRevalidation/**`.

The module should expose:

- normalized event types for supported collection, global, redirect, deferred, and private-live/no-op event inputs
- a serializable revalidation plan type containing operation, source, subject, cache classes, surface IDs, tags, paths, and redacted log context
- a pure planner that consumes PR 2 cache-policy builders and catalog data
- an executor that imports `revalidateTag` and `revalidatePath` from `next/cache`
- a redacted log payload builder or equivalent helper for planned, executed, and failed revalidation logs
- a compact public API that future PRs can call from hooks, seed flows, and discovery owners without importing internal planner helpers

Planner behavior:

- accept normalized events only
- compute tags and paths from the PR 2 policy map
- dedupe tags and paths deterministically while preserving tag-first, path-second execution intent
- return empty plans only for explicitly private-live/no-op events
- throw on unknown public-cache owners, unsupported operations, missing required subject fields, unmapped surface IDs, or redirect policy gaps
- preserve slug strings according to the PR 2 policy-map builder rules
- include old and new slug inputs in plans when both are relevant and supplied
- never import Payload, Next cache APIs, logger utilities, route modules, request objects, environment readers, database clients, PostHog utilities, or filesystem APIs

Executor behavior:

- execute all planned tags first with `revalidateTag(tag, { expire: 0 })`
- execute all planned paths after tags with `revalidatePath(path)`
- continue after individual tag or path failures
- return a serializable result with attempted, succeeded, and failed tag and path counts
- include failed tag or path identifiers in the result only when they are canonical public cache identifiers
- avoid throwing for individual `revalidateTag` or `revalidatePath` failures
- throw only for invalid executor input that cannot represent a planner-produced plan
- avoid reading request data, Payload docs, cookies, headers, tokens, secrets, sessions, private form data, or unrelated CMS fields

Log payload behavior:

- stable event names include `cache.revalidation.planned`, `cache.revalidation.executed`, and `cache.revalidation.failed`
- payloads include operation, source kind, source identifier, subject identifiers, cache classes, surface IDs, counts, failure counts, and a non-sensitive correlation field when supplied by the caller
- payloads do not include raw documents, request bodies, headers, cookies, tokens, secrets, auth sessions, form submissions, private route data, preview/draft document content, or unrelated CMS field values
- log helpers remain server-only and compatible with ADR 010 Payload/Pino logging conventions
- PR 3 does not add dashboard storage, PostHog capture, analytics events, or PR 8 visibility UI

The future implementation may choose local filenames inside `src/utilities/cacheRevalidation/**`, but it must keep the pure planner and side-effecting executor separated by imports and tests.

## Expected Tests

Add focused unit coverage for the new revalidation module.

The tests must prove:

- planner output is serializable and contains operation, source, subject, cache classes, surface IDs, tags, paths, and redacted log context
- planner events for Pages and Posts produce detail paths, collection/entity/slug tags, and sitemap/list surface tags according to the PR 1 matrix and PR 2 policy map
- planner events for Header, Footer, LandingPages, and CookieConsent produce the expected global and surface tags and known landing paths where applicable
- redirect planner support is available only when the PR 2 policy map exposes a canonical redirect policy entry
- unknown public-cache events, unsupported operations, missing identifiers, and unmapped surfaces fail fast
- explicitly private-live/no-op events return empty plans without cache side effects
- deferred clinic/listing, discovery, seed/bulk, and media cases are represented as typed unsupported/deferred cases and do not silently produce empty public plans
- duplicate tags and paths are deduped deterministically
- executor calls `revalidateTag` before `revalidatePath`
- executor continues after individual tag or path failures and returns a best-effort summary result
- executor logs planned, executed, and failed outcomes through the redacted log payload contract
- log payload builders exclude raw docs, request bodies, cookies, tokens, secrets, sessions, private data, preview/draft content, and unrelated CMS fields
- the pure planner module does not import `next/cache`, Payload, logger utilities, route modules, request objects, environment readers, database clients, or PostHog utilities

Tests should live near existing utility tests, for example under `tests/unit/utilities/cacheRevalidation/**`.

Do not write tests that only duplicate constants. Prefer behavior-focused assertions that fail when a future hook, seed, or discovery owner would receive an incomplete or unsafe plan.

## Validation

The future PR 3 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/utilities/cacheRevalidation --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
```

Run `pnpm build` only if PR 3 unexpectedly expands into Next.js routing, Payload config, route output, or other build-output-affecting files. Under this work order, it should not.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 3 implementation:

- `security-reviewer` for server trust boundary, fail-fast behavior, and redacted operational logging
- `seo-reviewer` for sitemap, discovery, canonical surface, and tag/path mapping alignment
- `web-vitals-reviewer` for cache and performance semantics

Skip UI, accessibility, mobile UI, and Storybook reviewers unless the scope expands into those surfaces.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before PR 4 starts, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 3 is complete when:

- `src/utilities/cacheRevalidation/**` exists and separates pure planning from runtime execution
- planner input is normalized and does not require raw Payload hook args or raw docs
- the planner imports policy-map contracts but no side-effecting runtime dependencies
- the executor imports `next/cache` and executes tags before paths
- execution is best-effort and returns structured result summaries
- planned, executed, and failed log payloads use a stable redacted schema
- PR 4 core surfaces have executable planner coverage, subject to the redirect policy guard
- clinic/listing, discovery, seed/bulk, media, and PR 8 visibility areas remain explicit deferred cases
- no existing hooks, routes, sitemaps, seed flows, media hooks, cache helpers, route modes, or `unstable_cache` call sites change
- validation passes
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023, the PR 1 implementation plan, or the PR 2 policy map appears wrong or incomplete
- a new cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate seems necessary
- PR 2 did not provide enough policy-map surface data for PR 3 to plan PR 4 core surfaces
- redirect support would require inventing a canonical redirect policy inside PR 3
- raw Payload docs, request objects, cookies, sessions, headers, or unrelated CMS fields appear necessary for planner output
- runtime hook wiring is required to make the planner useful
- legacy dual-tagging seems required
- `getCachedDocument` must be changed to keep PR 3 coherent
- Redis, custom cache handlers, remote cache storage, locks, dedupe, or runtime cache persistence appear necessary
- a PostHog business event or dashboard UI becomes necessary for cache visibility

Do not patch ADR 023, the PR 1 implementation plan, or the PR 2 work order inside PR 3. Those are architecture or predecessor-contract changes and must be handled separately.

## Assumptions

- PR 1 is merged into `main` and remains the operative stack/order/governance source.
- PR 2 remains valid and creates the pure `src/utilities/cachePolicy/**` contract before PR 3 starts.
- ADR 023 remains the architecture contract.
- PR 3 may define runtime planner and executor contracts, but it must not change cache assignments or architecture decisions.
- PR 4 will migrate Pages, Posts, Header, Footer, LandingPages, CookieConsent, and Redirects through the planner.
- PR 6 and PR 7 will expand planner coverage for clinic/listing, discovery, seed/bulk, and related public surfaces.
- PR 8 will consume redacted operational outputs for privileged visibility if that scope is still needed.
- The future full-stack execution goal may start PR 3 only after PR 2 is complete and reviewer-clean.
