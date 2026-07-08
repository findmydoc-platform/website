# PR 4 Work Order: Core Hooks

This work order defines the future PR 4 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 4 and does not change runtime behavior.

## Summary

PR 4 routes the first runtime hook group through the PR 3 revalidation planner and executor boundary. It migrates the core public CMS hooks and the directly matching read-side cache tags together so write-side invalidation and read-side cache tags do not drift.

- Branch: `feature/cache-revalidation/04-core-hooks`
- PR title: `refactor(hooks): route cache stack 4/8 core hooks through planner`
- Base branch: `feature/cache-revalidation/03-planner-executor`
- Dependency: PR 3 is implemented, validated, reviewer-clean, and based on the accepted PR 1 plan.
- Scope type: core runtime hook migration.

The implementation must not ask the executor to decide cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [Public Cache And Revalidation Implementation Plan](../cache-revalidation-implementation-plan.md)
- [PR 2 Work Order: Cache Policy Map](./pr-02-policy-map.md)
- Future PR 2 `src/utilities/cachePolicy/**` implementation output
- [PR 3 Work Order: Revalidation Planner And Executor](./pr-03-planner-executor.md)
- Future PR 3 `src/utilities/cacheRevalidation/**` implementation output
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)
- Current core hook files: `src/collections/Pages/hooks/revalidatePage.ts`, `src/collections/Posts/hooks/revalidatePost.ts`, `src/globals/Header/hooks/revalidateHeader.ts`, `src/globals/Footer/hooks/revalidateFooter.ts`, `src/globals/LandingPages/hooks/revalidateLandingPages.ts`, `src/globals/CookieConsent/hooks/revalidateCookieConsent.ts`, and `src/hooks/revalidateRedirects.ts`
- Current matching read-side files: `src/utilities/getGlobals.ts`, `src/utilities/getRedirects.ts`, `src/app/(frontend)/(sitemaps)/pages-sitemap.xml/route.ts`, and `src/app/(frontend)/(sitemaps)/posts-sitemap.xml/route.ts`

## Objective

Route Pages, Posts, Header, Footer, LandingPages, CookieConsent, and Redirects through the PR 3 planner/executor boundary while replacing the touched legacy tags with canonical ADR-023 tags from the PR 2 policy builders.

PR 4 must make the first real runtime owner group consume the central cache architecture. The core hook adapters extract stable primitives from Payload hook inputs, call the PR 3 boundary with normalized events, and leave tag/path computation to the planner.

PR 4 also updates the directly matching read-side cache tags for globals, redirects, and Pages/Posts sitemap caches so the new canonical hook invalidation actually reaches the cached reads it owns.

## Non-Goals

PR 4 must not:

- add or change cache classes, tag families, freshness policies, invalidation owners, public/private boundaries, PR order, or reviewer gates
- change ADR 023, the PR 1 implementation plan, the PR 2 policy-map contract, or the PR 3 planner/executor contract
- route clinic detail, Listing Comparison, related clinic-visible collections, discovery expansion, seed/bulk flows, direct media dependency resolution, or observability UI through the planner
- change `src/hooks/media/revalidateMediaConsumers.ts`
- change `src/endpoints/seed/**`
- repair, remove, or rewire `getCachedDocument`
- change redirect target-document lookup behavior in `src/app/(frontend)/_components/PayloadRedirects/**`
- alter route `dynamic`, `revalidate`, `force-static`, or `force-dynamic` behavior
- change sitemap route content, sitemap discovery policy, noindex behavior, or source-backed timestamp rules
- enumerate paginated blog list paths beyond the canonical `/posts` list path
- add legacy dual-tagging for `global_header`, `global_footer`, `global_landingPages`, `global_cookieConsent`, `pages-sitemap`, `posts-sitemap`, `redirects`, or `${collection}_${slug}`
- add Redis, a custom cache handler, remote cache storage, locks, dedupe, or runtime cache persistence
- add PostHog events or dashboard/admin visibility

## Fixed Decisions

PR 4 uses these decisions without reopening them:

- Scope: Pages, Posts, Header, Footer, LandingPages, CookieConsent, and Redirects.
- Hook boundary: touched hook files stop importing `next/cache`; they consume the PR 3 public planner/executor API.
- Read-side scope: only the matching read-side tags for `getCachedGlobal`, `getCachedRedirects`, Pages sitemap cache, and Posts sitemap cache are migrated.
- `disableRevalidate`: remains hook-adapter responsibility. When `context.disableRevalidate` is set, the adapter returns the document without creating a plan or executing revalidation.
- Planner inputs: normalized event objects only. The planner must not receive raw Payload hook args, raw documents, request objects, or route modules.
- Stable input extraction: hook adapters may read only stable primitive fields required by PR 3, such as id, slug, previous slug, status, previous status, global slug, redirect id, source kind, and operation.
- Contract errors: missing required primitives, unsupported operations, invalid hook states, unmapped surfaces, or missing canonical redirect support throw instead of being silently logged away.
- Executor failures: individual `revalidateTag` or `revalidatePath` failures remain best-effort through the PR 3 executor and must not break CMS writes.
- Posts list freshness: Post changes revalidate canonical post detail output plus collection/list/sitemap tags and the known `/posts` list path. PR 4 does not revalidate `/posts/page/[pageNumber]` paths.
- Redirect support: PR 4 may migrate redirects only if PR 2 and PR 3 expose canonical redirect policy/planner support. Otherwise it must stop instead of inventing redirect tags locally.
- Legacy tags: touched PR 4 surfaces use canonical tags only; no transition period with both legacy and canonical tags.

## Expected Implementation Shape

The future implementation should keep changes narrow and adapt the existing hook files in place.

Hook adapter behavior:

- `src/collections/Pages/hooks/revalidatePage.ts` builds normalized Pages after-change and after-delete events from id, slug, previous slug, status, and previous status, then executes the PR 3 plan.
- `src/collections/Posts/hooks/revalidatePost.ts` builds normalized Posts after-change and after-delete events from id, slug, previous slug, status, and previous status, then executes the PR 3 plan.
- Header, Footer, LandingPages, and CookieConsent global hooks build normalized global-update events with their known global slug, then execute the PR 3 plan.
- `src/hooks/revalidateRedirects.ts` builds a normalized redirect-update event with the redirect subject identifier required by PR 3, then executes the PR 3 plan.
- Hook adapters preserve the existing return-doc behavior after successful planning/execution and after best-effort executor failures.
- Hook adapters do not compute tags or paths directly and do not import PR 3 internal helpers that bypass the public planner/executor API.

Read-side cache behavior:

- `src/utilities/getGlobals.ts` uses the PR 2 global tag builder for `global:<slug>` tags.
- `src/utilities/getRedirects.ts` uses only the canonical redirect cache tag or tags exposed by PR 2. If no canonical redirect policy exists, PR 4 stops.
- Pages sitemap and Posts sitemap route caches use the PR 2 sitemap tag builders, such as `surface:sitemap:pages` and `surface:sitemap:posts`, without changing sitemap route output.
- Read-side cache keys may remain otherwise unchanged unless PR 2/PR 3 explicitly require a key change for correctness.

Logging behavior:

- PR 4 hook adapters rely on PR 3 planned, executed, and failed operational log payloads.
- PR 4 must not add raw document logging, raw request logging, PostHog capture, dashboard storage, or ad hoc log payload shapes.
- Any retained hook-level log statements must stay non-sensitive and must not duplicate or contradict PR 3 operational logs.

Deferred legacy areas remain untouched even if they still contain legacy tags after PR 4:

- `src/hooks/media/revalidateMediaConsumers.ts`
- `src/endpoints/seed/**`
- `src/utilities/getDocument.ts`
- clinic/listing hooks and server data
- public discovery expansion and `llms.txt`
- PR 8 observability surfaces

## Expected Tests

Update and add focused unit coverage for the migrated core hook group and matching read-side tags.

The tests must prove:

- Pages hooks return the document and route through the PR 3 boundary for published updates, unpublishes, deletes, and slug changes.
- Posts hooks return the document and route through the PR 3 boundary for published updates, unpublishes, deletes, slug changes, and `/posts` list freshness.
- Page and Post hook events include old and new slug/status values when relevant.
- Header, Footer, LandingPages, and CookieConsent hooks build the expected global-update events.
- Redirect hooks build the expected redirect event only when PR 2/PR 3 canonical redirect support exists.
- `disableRevalidate` skips planning and execution for every migrated hook.
- adapter contract errors for missing ids, missing slugs, missing required statuses, unsupported operations, or redirect policy gaps throw instead of silently returning a document.
- executor failures returned through the PR 3 best-effort result do not break CMS writes.
- touched hook files no longer import `next/cache`.
- touched read-side utilities and sitemap routes use canonical PR 2 tag builders.
- no touched PR 4 surface emits legacy tags such as `global_header`, `global_footer`, `global_landingPages`, `global_cookieConsent`, `pages-sitemap`, `posts-sitemap`, `redirects`, or `${collection}_${slug}`.
- `getCachedDocument`, media consumer hooks, and seed flows are not changed by PR 4.

Expected test files include:

- `tests/unit/hooks/revalidatePage.test.ts`
- `tests/unit/hooks/revalidatePost.test.ts`
- `tests/unit/hooks/revalidateRedirects.test.ts`
- `tests/unit/hooks/revalidateGlobals.test.ts`
- `tests/unit/utilities/payloadDataFetchers.test.ts`
- `tests/unit/app/frontend/sitemap.routes.test.ts`

Do not write tests that only duplicate constants. Prefer behavior-focused assertions that fail when a future core hook bypasses the planner, loses old-slug coverage, reintroduces legacy tags, or stops invalidating its matching read-side cache.

## Validation

The future PR 4 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/hooks/revalidatePage.test.ts tests/unit/hooks/revalidatePost.test.ts tests/unit/hooks/revalidateRedirects.test.ts tests/unit/hooks/revalidateGlobals.test.ts tests/unit/utilities/payloadDataFetchers.test.ts tests/unit/app/frontend/sitemap.routes.test.ts --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
rtk proxy /Users/razorspoint/Library/pnpm/pnpm build
```

Build is required for the future runtime PR because PR 4 changes hook/runtime code and read-side cache tags that affect Next.js/Payload behavior.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 4 implementation:

- `security-reviewer` for server trust boundaries, raw-data exclusion, strict adapter errors, and private/public cache separation
- `seo-reviewer` for canonical page, post, redirect, sitemap, and public discovery cache behavior
- `web-vitals-reviewer` for cache and performance semantics after the first runtime hook migration

Skip UI, accessibility, mobile UI, and Storybook reviewers unless the scope expands into those surfaces.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before PR 5 starts, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 4 is complete when:

- Pages, Posts, Header, Footer, LandingPages, CookieConsent, and Redirects route revalidation through the PR 3 public boundary
- touched hook files no longer import `next/cache`
- `disableRevalidate` skips planning and execution across all migrated hooks
- hook adapters pass normalized stable primitives rather than raw Payload docs or hook args into the planner
- contract errors are strict and executor revalidation failures remain best-effort
- touched read-side cache tags align with the canonical PR 2 tags consumed by the migrated hooks
- Posts updates include `/posts` list freshness but no paginated path enumeration
- redirects are migrated only when canonical redirect policy/planner support exists
- legacy dual-tags are not emitted by touched PR 4 surfaces
- media, seed/bulk, clinic/listing, discovery expansion, observability, `getCachedDocument`, and redirect target-document repair remain outside PR 4
- required tests and validation pass
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023, the PR 1 implementation plan, the PR 2 policy map, or the PR 3 planner/executor contract appears wrong or incomplete
- PR 2 lacks canonical builders for any PR 4 core read-side tag
- PR 3 lacks a public planner/executor API for any PR 4 core event
- redirect support would require inventing a canonical redirect tag or planner case inside PR 4
- raw Payload docs, request objects, cookies, sessions, headers, or unrelated CMS fields appear necessary for planner input
- runtime behavior requires legacy dual-tagging to stay correct
- `getCachedDocument` must be changed to keep PR 4 coherent
- media dependency resolution, seed/bulk final flushing, clinic/listing invalidation, public discovery expansion, or observability UI becomes necessary
- paginated blog list path enumeration appears necessary
- Redis, custom cache handlers, remote cache storage, locks, dedupe, or runtime cache persistence appears necessary
- a new PostHog event, cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate seems necessary

Do not patch ADR 023, the PR 1 implementation plan, PR 2, or PR 3 inside PR 4. Those are architecture or predecessor-contract changes and must be handled separately.

## Assumptions

- PR 1 is merged into `main` and remains the operative stack/order/governance source.
- PR 2 creates the pure `src/utilities/cachePolicy/**` contract before PR 4 starts.
- PR 3 creates the `src/utilities/cacheRevalidation/**` planner/executor boundary before PR 4 starts.
- PR 2 exposes canonical policy builders for all PR 4 core surfaces.
- PR 3 exposes public normalized-event planner/executor APIs for all PR 4 core surfaces.
- ADR 023 remains the architecture contract.
- PR 4 may consume PR 2 and PR 3 APIs but must not redefine their architecture.
- PR 5 handles redirect target-document drift and `getCachedDocument` cleanup.
- PR 6 and PR 7 expand planner coverage for clinic/listing, discovery, seed/bulk, and related public surfaces.
- PR 8 consumes redacted operational outputs for privileged visibility if that scope is still needed.
- The future full-stack execution goal may start PR 4 only after PR 3 is complete and reviewer-clean.
