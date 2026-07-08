# PR 8 Work Order: Observability

This work order defines the future PR 8 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 8 and does not change runtime behavior.

## Summary

PR 8 adds redacted operational cache/revalidation visibility for privileged platform staff. It consumes the PR 3 planner/executor summaries after PR 7 has routed discovery, posts-list, and seed final-flush events through the cache stack.

- Branch: `feature/cache-revalidation/08-observability`
- PR title: `feat(admin): expose cache stack 8/8 invalidation visibility`
- Base branch: `feature/cache-revalidation/07-discovery-and-seeding`
- Dependency: PR 7 is implemented, validated, reviewer-clean, and based on the accepted PR 1 plan.
- Scope type: operational observability and admin visibility.

PR 8 must not ask the executor to decide cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [Public Cache And Revalidation Implementation Plan](../cache-revalidation-implementation-plan.md)
- [PR 2 Work Order: Cache Policy Map](./pr-02-policy-map.md)
- Future PR 2 `src/utilities/cachePolicy/**` implementation output
- [PR 3 Work Order: Revalidation Planner And Executor](./pr-03-planner-executor.md)
- Future PR 3 `src/utilities/cacheRevalidation/**` planner, executor, redacted log, and execution-result output
- [PR 4 Work Order: Core Hooks](./pr-04-core-hooks.md)
- Future PR 4 core hook and read-side tag output
- [PR 5 Work Order: Redirect Document Reads](./pr-05-redirect-documents.md)
- Future PR 5 redirect document read output
- [PR 6 Work Order: Clinic And Listing Surfaces](./pr-06-clinic-listing-surfaces.md)
- Future PR 6 clinic/listing output
- [PR 7 Work Order: Discovery And Seeding](./pr-07-discovery-and-seeding.md)
- Future PR 7 discovery, posts-list, and seed final-flush output
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)
- [PostHog Integration](../../../integrations/posthog.md)
- [Logging Guide](../../../logging.md)
- Current admin dashboard files: `src/dashboard/adminDashboard/config.ts`, `src/dashboard/adminDashboard/AGENTS.md`, and `tests/unit/dashboard/adminDashboard/config.test.ts`
- Current Developer Dashboard files: `src/components/organisms/DeveloperDashboard/**`, `src/components/organisms/DeveloperDashboard/AGENTS.md`, `tests/unit/components/seedingCard.test.tsx`, and `tests/unit/components/seedingCardView.test.tsx`
- Current access-control files: `src/access/isPlatformBasicUser.ts`, `src/access/fieldAccess.ts`, `src/collections/PlatformStaff.ts`, and related access tests
- Current logging files: `src/utilities/logging/**` and `tests/unit/utilities/loggingShared.test.ts`

## Objective

Expose recent cache and revalidation decisions to privileged platform operators without changing cache behavior.

PR 8 must make planner/executor activity visible through redacted operational history and a minimal Payload Admin dashboard card. This visibility is diagnostic only. It must not become product analytics, an audit log, a persistent data store, or a manual cache-control surface.

## Non-Goals

PR 8 must not:

- add or change cache classes, tag families, freshness policies, invalidation owners, public/private boundaries, PR order, or reviewer gates
- change ADR 023, the PR 1 implementation plan, or the PR 2-PR 7 architecture contracts
- change public routes, sitemap output, discovery output, redirect behavior, canonical/noindex policy, seed behavior, route cache settings, cache tags, planner decisions, or revalidation semantics
- add manual cache actions such as revalidate, retry, flush, purge, reset, or path/tag mutation controls
- add Payload collections, database tables, migrations, persistent history, external log drains, or audit-log storage
- add PostHog events, PostHog Actions, product analytics capture, or business telemetry for cache mechanics
- expose raw documents, raw Payload hook args, request bodies, headers, cookies, tokens, auth data, private data, draft/preview content, CMS field payloads, medical free text, seed fixture payloads, or raw error stacks
- implement direct media dependency resolution
- add Redis, custom cache handlers, remote cache storage, locks, dedupe, or runtime cache persistence
- add legacy dual-tagging or emit legacy tags from touched PR 8 code

## Fixed Decisions

PR 8 uses these decisions without reopening them:

- Visibility shape: a minimal Payload Admin dashboard card is implemented.
- History source: a bounded in-memory ring buffer stores recent redacted cache/revalidation summaries per runtime instance.
- Ring-buffer size: keep the latest 200 events per runtime instance.
- Persistence boundary: the in-memory history is volatile and not an audit log.
- Access boundary: only `basicUsers` with `userType === "platform"` and a matching `platformStaff` profile with `role` in `["admin", "support"]` may read visibility data.
- Denied roles: `content-manager`, clinic users, patient users, anonymous requests, missing platform staff profiles, and role lookup failures are denied.
- Endpoint boundary: the protected read endpoint must complete access control before reading the in-memory history.
- UI boundary: the dashboard card is read-only and diagnostic.
- Analytics boundary: no PostHog events are added.
- Follow-up boundary: a separate lightweight issue captures direct media dependency resolution; PR 8 does not implement that resolver.

PR 8 should add one dedicated Payload dashboard widget for cache visibility, for example slug `cache-revalidation-visibility`, while preserving the existing `developer-seeding` widget and layout behavior. If Payload dashboard constraints require placing the card inside the existing Developer Dashboard component instead, the implementation must keep the same access-control, read-only, and test requirements.

## Expected Implementation Shape

Visibility history:

- extend `src/utilities/cacheRevalidation/**` with a small visibility/history sink that records only redacted PR 3 planner/executor summaries
- record summaries for `cache.revalidation.planned`, `cache.revalidation.executed`, and `cache.revalidation.failed`
- keep planner purity intact; the pure planner must not import the visibility sink, logger utilities, Payload, request objects, or UI modules
- keep executor ordering intact; tags still execute before paths and failures remain best-effort
- expose small helpers to record a redacted event, read a snapshot, and clear/reset history for tests only
- dedupe nothing beyond the planner/executor result that PR 3 already produced; the visibility layer is observational
- keep the buffer bounded to 200 events with newest-event ordering in the returned snapshot

Stored event shape:

- store only timestamp, event name, operation, source kind, source id, subject identifiers, cache classes, surface IDs, tag count, path count, failure count, capped tag previews, capped path previews, capped failure summaries, and truncation flags
- cap exposed tag previews, path previews, and failure summaries to a small fixed count such as 10 entries each
- keep full counts even when previews are truncated
- accept only canonical public cache identifiers, surface IDs, operation names, and redacted failure summaries from the PR 3 result/log payload contracts
- never store raw docs, raw Payload hook args, request bodies, headers, cookies, tokens, auth data, private data, draft/preview content, CMS field payloads, medical free text, seed fixture payloads, or raw error stacks

Protected endpoint:

- add a Payload endpoint such as `GET /api/cache-revalidation/visibility`
- use the existing Payload endpoint pattern from the seed endpoint and register it in `src/payload.config.ts`
- fail closed when the request user is missing, not a `basicUsers` platform user, has no matching `platformStaff` profile, has a denied role, or the role lookup fails
- perform the platform-staff role lookup before reading the visibility ring buffer
- return only the redacted history snapshot plus operational metadata such as buffer limit, count, and truncation status
- log access-control lookup failures through ADR 010-compatible redacted operational logs
- do not include raw auth state, profile documents, request headers, cookies, or user profile fields in the response or logs

Admin dashboard card:

- add a minimal read-only dashboard card under the existing Payload Admin dashboard/widget conventions
- show recent event name/status, operation/source, surfaces, tag/path counts, failure counts, and a manual refresh button that only refetches the protected read endpoint
- show empty, loading, error, and access-denied states without leaking event data to unauthorized users
- keep the card purely operational; do not add public-discovery data, sitemap/robots links, canonical/indexation controls, or links to crawlable public surfaces in PR 8
- keep controls typed and normalized at component boundaries
- use Payload admin theme variables and existing Developer Dashboard visual conventions
- keep the existing seeding widget behavior intact
- do not add manual cache mutation buttons or controls

Follow-up issue:

- before opening the future PR 8 implementation PR, create or link a lightweight website issue for bounded direct media dependency resolution
- the issue must describe the unresolved problem that direct media replacement can leave referencing public surfaces stale until the referencing document changes
- the issue must not be implemented or folded into PR 8

## Expected Tests

Add focused unit coverage for visibility history, redaction, protected access, and dashboard rendering.

The tests must prove:

- ring-buffer ordering is newest-first or otherwise documented and stable
- the buffer keeps at most 200 events and drops oldest entries when full
- test-only reset/isolation helpers prevent cross-test history leakage
- recorded `planned`, `executed`, and `failed` summaries preserve counts and capped previews
- preview truncation flags are set when tag, path, or failure previews exceed their cap
- forbidden values are not stored or exposed, including raw docs, Payload hook args, request bodies, headers, cookies, tokens, auth data, private data, CMS field payloads, seed fixture payloads, medical free text, and raw error stacks
- executor/history integration records planned, executed, and failed events without changing tag-first/path-second order
- the protected endpoint allows platform `admin` and `support`
- the endpoint denies platform `content-manager`, clinic, patient, anonymous, missing platform staff profile, and role lookup failure
- the endpoint does not read the history sink before access control passes
- the endpoint response contains only redacted history and non-sensitive operational metadata
- dashboard config registers the cache visibility card or widget without removing or regressing the existing seeding widget
- the Admin card renders empty, denied, success, failure, loading, and manual-refresh states
- the Admin card does not render manual cache mutation controls
- no PR 8 code captures PostHog business events

Expected test files include:

- `tests/unit/utilities/cacheRevalidation/**`
- `tests/unit/endpoints/cacheRevalidationVisibility.test.ts`
- `tests/unit/components/cacheRevalidationVisibility.test.tsx`
- `tests/unit/dashboard/adminDashboard/config.test.ts`

Do not write tests that only duplicate constants. Prefer behavior-focused assertions that fail when visibility reads bypass access control, raw data reaches history/UI, manual cache actions appear, PostHog capture is added, or the seeding dashboard widget regresses.

## Validation

The future PR 8 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/utilities/cacheRevalidation tests/unit/endpoints/cacheRevalidationVisibility.test.ts tests/unit/components/cacheRevalidationVisibility.test.tsx tests/unit/dashboard/adminDashboard/config.test.ts --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
rtk proxy /Users/razorspoint/Library/pnpm/pnpm build
```

Because PR 8 adds rendered admin UI, the future implementation must also capture Playwright admin dashboard screenshot evidence using the existing ignored artifacts/session workflow. Use the shared admin session `output/playwright/sessions/admin.local.json` when available; refresh and validate it with the existing admin session commands if needed.

Build is required for the future runtime PR because PR 8 changes Payload endpoint registration and rendered admin UI.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 8 implementation:

- `security-reviewer` for endpoint authorization, role lookup, redaction, private/public boundary, and no raw operational data exposure
- `accessibility-reviewer` for the rendered Admin card states, keyboard/focus behavior, loading/error announcements, and read-only controls
- `mobile-ui-reviewer` for responsive Admin dashboard behavior and dense event-table/card readability

Skip `seo-reviewer` unless PR 8 changes discovery output, sitemap output, robots behavior, redirects, canonical/noindex behavior, structured data, public-discovery data, links to crawlable public surfaces, or other public discovery behavior.

Skip `web-vitals-reviewer` unless PR 8 changes public route rendering, public route runtime cache behavior, bundle-sensitive public code, or public performance semantics.

Skip Storybook reviewer unless PR 8 changes Storybook stories, Storybook config, or story-governance files.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before the stack is considered complete, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 8 is complete when:

- recent PR 3-PR 7 cache/revalidation planner and executor outcomes are visible through a redacted bounded in-memory history
- the ring buffer is capped at 200 events per runtime instance
- the visibility history is explicitly volatile and not persistent audit storage
- `cache.revalidation.planned`, `cache.revalidation.executed`, and `cache.revalidation.failed` summaries are recorded without changing planner purity or executor semantics
- the protected endpoint checks platform admin/support access before reading history
- platform content-manager, clinic, patient, anonymous, missing profile, and role lookup failure cases are denied
- the dashboard card is read-only and exposes only redacted operational summaries
- the existing seeding dashboard widget remains registered and behavior-compatible
- no raw docs, request data, auth data, private data, CMS field payloads, seed fixture payloads, medical free text, or raw error stacks are stored or exposed
- no PostHog event, product analytics capture, manual cache action, persistent store, Redis/custom cache store, migration, direct media dependency resolver, new cache class, new tag family, new invalidation owner, public route change, or discovery output change is introduced
- the direct media dependency resolver follow-up issue is created or linked before opening the future PR 8 implementation PR
- required tests, validation, and admin screenshot evidence pass
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023, the PR 1 implementation plan, or PR 2-PR 7 outputs appear wrong or incomplete
- a new cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate seems necessary
- PR 3 does not expose redacted planner/executor summaries stable enough for PR 8 to consume
- PR 7 did not route seed final-flush, posts-list, or discovery events through the planner as expected
- visibility requires persistent storage, Payload collections, migrations, external log drains, Redis, custom cache storage, or multi-instance history
- direct media dependency resolution becomes necessary to make PR 8 coherent
- a manual cache mutation control is requested or appears necessary
- endpoint authorization cannot be implemented without reading history first
- access control requires broader roles than platform admin/support
- the dashboard would need to expose raw operational data, raw errors, request data, auth data, private data, CMS field payloads, or seed fixture payloads
- PostHog product analytics events appear necessary
- public routes, public discovery output, sitemap output, redirects, canonical/noindex behavior, seed behavior, cache tags, planner decisions, or revalidation semantics need to change

Do not patch ADR 023, the PR 1 implementation plan, or PR 2-PR 7 work orders inside PR 8. Those are architecture or predecessor-contract changes and must be handled separately.

## Assumptions

- PR 1 is merged into `main` and remains the operative stack/order/governance source.
- PR 2 creates the pure `src/utilities/cachePolicy/**` contract before PR 8 starts.
- PR 3 creates stable redacted planner/executor summaries that PR 8 can consume.
- PR 4-PR 6 route core hooks, redirects, clinic detail, and Listing Comparison through the cache stack before PR 8 starts.
- PR 7 routes discovery, posts-list, and seed final-flush events through the planner before PR 8 starts.
- A volatile per-instance in-memory history is sufficient for first-stack operational visibility and is intentionally not an audit log.
- Platform admin and support roles are the accepted visibility boundary.
- The existing Payload Admin dashboard and Developer Dashboard conventions are sufficient for a minimal read-only cache visibility card.
- PR 8 may define runtime visibility contracts, but must not change cache assignments or architecture decisions.
- The future full-stack execution goal may start PR 8 only after PR 7 is complete and reviewer-clean.
