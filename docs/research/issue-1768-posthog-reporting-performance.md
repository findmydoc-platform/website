# Issue 1768: PostHog Reporting Performance and Failure Boundaries

## Scope and method

This note evaluates PostHog as a server-side reporting source for tenant-scoped clinic dashboard metrics. The live checks targeted the active `findmydoc` PostHog project in the `Europe/Berlin` timezone on 31 August 2026.

The measurement used the connected PostHog API to:

- verify the project, event schema, event properties, and one available clinic identifier before querying;
- execute three read-only `TrendsQuery` samples for each of the 7-, 30-, and 90-day windows;
- count `clinic_profile_viewed` and `clinic_cta_clicked` with an exact event-property filter on `clinic_id`;
- avoid event rows, person rows, patient data, free text, and publication of the clinic identifier.

The reported latency is the client-observed duration around each connected-tool call. It includes PostHog execution, the connector, and network overhead. The connector did not expose PostHog's `is_cached`, cache-age, or server timing fields, so these measurements cannot distinguish cached from uncached execution. No timeout, rate-limit, or outage was induced against the production analytics project.

## Executive judgement

Direct PostHog aggregate queries are viable as one input to the first reporting version, but the current evidence does not support making PostHog a synchronous, authoritative, always-available dependency for the whole dashboard.

- All nine representative tenant-filtered queries completed in 0.562-1.104 seconds. The data volume was extremely small, so this is a connectivity baseline, not a production SLO or scale test.
- PostHog documents project-level Query API limits of 240 requests per minute, 2,400 per hour, three concurrent queries, and ten seconds of execution time. A query can additionally wait in the queue for up to 30 seconds.
- The sustained hourly limit averages 40 query starts per minute. One consolidated PostHog query per dashboard load is therefore materially safer than separate calls per metric or period.
- `patient_inquiry_created` is registered and emitted by the repository, but it was absent from the active PostHog event schema. Its PostHog latency and completeness could not be measured.
- Browser-captured profile views and CTA clicks are consent-controlled and can be influenced by public-client traffic. They are useful marketing analytics, not authoritative business records. Inquiry totals should remain anchored in Payload data.
- A reporting response must represent source freshness, coverage, and partial failure explicitly. A PostHog failure must not turn an unknown value into zero or suppress independent Payload-backed metrics.

The architecture decision still needs a customer-facing latency target, maximum acceptable staleness, expected dashboard request rate, source-specific fallback policy, and a decision on whether last-successful aggregates are persisted.

## Measured project facts

### Available events and tenant filters

The live project schema returned `clinic_profile_viewed` and `clinic_cta_clicked`. Both expose `clinic_id` and `clinic_slug` as string event properties. The schema returned an available value for `clinic_id`, which was used internally for exact filtering and is intentionally omitted here.

The live schema did not return `patient_inquiry_created`. The repository nevertheless defines it as a governed business event and captures it after an accepted clinic-profile form submission when analytics consent is available ([event registry](../../src/posthog/events.ts), [form bridge](<../../src/app/api/form-bridge/[slug]/route.ts>)). This establishes an implementation contract, not evidence that the active project currently contains queryable inquiry events.

### Representative query shape

Each sample used one PostHog `TrendsQuery` containing two total-count series. Each series had the same exact `clinic_id` event-property filter and one bounded date range. The samples did not use person joins, raw event rows, breakdowns, or pagination. They also did not exclude bots or test accounts; that exclusion remains a metric-definition decision.

| Window | Client-observed samples | Median | Observed aggregate values | Result |
| --- | --- | --- | --- | --- |
| 7 days | 0.625 s, 0.791 s, 0.902 s | 0.791 s | 2 profile views, 1 CTA click | 3/3 successful |
| 30 days | 0.605 s, 0.669 s, 0.847 s | 0.669 s | 3 profile views, 1 CTA click | 3/3 successful |
| 90 days | 0.562 s, 0.655 s, 1.104 s | 0.655 s | 3 profile views, 1 CTA click | 3/3 successful |

The nearly flat timings are consistent with a tiny dataset and possible cache reuse. They do not show that a 90-day query scales as well as a 7-day query under representative event volume.

## Current official PostHog boundaries

### Query purpose and authentication

PostHog explicitly supports the Query API for embedded analytics and aggregated data retrieval. It also says that `/query` is not an export mechanism and may reject export-like workloads. Private queries require a personal API key with Query Read permission; project secret API keys are a server-to-server beta option where available ([API queries](https://posthog.com/docs/api/queries), [API overview](https://posthog.com/docs/api), [Product Analytics API](https://posthog.com/docs/product-analytics/surfaces/api)).

The repository currently documents only the public project key, ingestion host, and secure feature-flag key. It does not define a server-side Query Read credential ([environment example](../../.env.example), [PostHog integration](../integrations/posthog.md)). The public project key cannot authorize private analytics queries, and the feature-flag key has a different responsibility. Credential ownership, rotation, and least-privilege scope are therefore unresolved implementation prerequisites.

### Rate, concurrency, timeout, and result limits

The current Query API documentation states these project-level limits ([API queries](https://posthog.com/docs/api/queries#rate-limits)):

| Boundary | Documented value | Reporting consequence |
| --- | --- | --- |
| Burst request rate | 240 requests per minute | Separate calls per card or period spend the burst budget quickly. |
| Sustained request rate | 2,400 requests per hour | Equivalent to 40 starts per minute when sustained for an hour. |
| Concurrent execution | 3 queries | Three parallel period calls from one page can consume the whole project budget. |
| Execution time | 10 seconds | This excludes HTTP and queue time, so it is not a safe dashboard timeout. |
| Queue wait | Up to 30 seconds | A saturated project can exceed a reasonable interactive wait before execution begins. |
| Threads per query | 60 | Internal execution bound; it does not increase client concurrency. |
| Rows | 100 by default, up to 50,000 with `LIMIT` | Aggregate reporting needs only a small fixed result and should not approach this bound. |

PostHog notes that some customers remain on a legacy limit of 120 queries per hour. The connected project metadata did not expose which rate-limit generation or billing plan applies. The implementation must verify actual response headers or account settings before treating the newer limits as a guaranteed project contract.

### Caching and asynchronous execution

PostHog caches Query API results by default. Responses may expose `is_cached`, `cache_key`, `cache_target_age`, `last_refresh`, and `next_allowed_client_refresh`. The `refresh` mode can prefer cached, blocking, asynchronous, or cache-only execution. Asynchronous queries return a query ID that clients poll; running queries can be cancelled ([caching and execution modes](https://posthog.com/docs/api/queries#caching-and-execution-modes)).

These controls make cache-aware background refresh feasible. They do not define the clinic dashboard's acceptable staleness. PostHog cache freshness and any findmydoc-owned last-successful snapshot must remain separate concepts in the reporting contract.

### Cost and data-read limits

The public pricing page meters Product Analytics primarily by captured events and lists one million analytics events per month in the free tier. It lists one-year retention for the free plan and seven-year retention for pay-as-you-go ([PostHog pricing](https://posthog.com/pricing)). The Query API documentation separately states that organizations without a paid plan may read 50 TB per calendar month; after that, uncached API queries return HTTP 402 while cached results continue to work ([Query API free-plan data limit](https://posthog.com/docs/api/queries#free-plan-data-limit)).

No official per-query price was found, and the connected organization metadata did not expose the current plan or data-read usage. Exact project cost therefore remains unverified. Query volume, bytes scanned, event ingestion, and retention must not be collapsed into one assumed price model.

### Performance guidance

PostHog recommends bounded time ranges, avoiding repeated scans, naming queries for `query_log` diagnostics, and materializing expensive recurring aggregates ([optimizing queries](https://posthog.com/docs/sql/optimizing-queries)). Materialized views are precomputed and can refresh from every 15 minutes to monthly; incremental refresh is currently beta ([materialized views](https://posthog.com/docs/data-warehouse/views/materialize)).

Materialization can improve speed but adds a second freshness schedule and PostHog-owned stored projection. It should be selected only after the metric, retention, and freshness decision, not as an automatic response to this small latency sample.

## Repository and trust-boundary evidence

The repository's governed event catalog defines all three proposed marketing events, their allowed properties, and their privacy boundaries. Profile views and CTA clicks are consent-eligible browser events. Inquiry creation is a consent-gated server event captured only after form acceptance. Operational submission success does not depend on analytics capture ([PostHog integration](../integrations/posthog.md), [event taxonomy ADR](../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)).

The approved clinic-dashboard architecture keeps Payload as the tenant, permission, business API, and persistence boundary. The dashboard is a stateless BFF and does not own a durable business database or shared cache ([clinic-dashboard BFF ADR](../adrs/026-adr-standalone-clinic-dashboard-bff-architecture.md), [clinic-dashboard API contract](../integrations/clinic-dashboard-api.md)).

Consequently, a safe reporting path is:

1. The Clinic Dashboard BFF authenticates the clinic user and calls a focused Payload reporting capability.
2. Payload derives the authoritative clinic from the current principal; the browser and BFF do not submit a clinic ID as authority.
3. The website's server-only PostHog adapter injects that clinic identifier into an exact aggregate filter.
4. Payload-backed business counts and PostHog-backed marketing counts retain separate source and coverage metadata.
5. The response exposes only fixed aggregate fields, never raw PostHog events, persons, identifiers, or query details.

An exact `clinic_id` filter is necessary for tenant isolation, but it is not sufficient for data integrity. The profile and CTA events originate from a public browser SDK, are consent-dependent, and may include automated or spoofed traffic. Authorization must happen before querying, and the metric definition must decide bot and test-account treatment.

## Safe performance and failure-contract conclusions

The following are architectural inferences from the measured and official facts, not accepted SLOs:

- **Consolidate reads.** A dashboard load should issue at most one PostHog query for its requested range, or one bounded aggregate query that returns all required ranges. It should not make one query per card, event, and period.
- **Budget below vendor limits.** The 2,400-per-hour cap is the sustained constraint, and other project consumers share it. Retries count against the same budget.
- **Set an application timeout below PostHog's maximum path.** Ten seconds of execution plus up to 30 seconds of queue time is incompatible with an interactive dependency. The exact shorter timeout belongs in the ADR after the dashboard latency target is chosen.
- **Do not retry validation or authorization failures.** HTTP 400, 401, 402, and 403 need explicit configuration or quota handling. For network errors, 429, and transient 5xx responses, use at most a small bounded retry with exponential backoff and jitter, preferably outside the user request. PostHog's current Query API documentation does not promise a `Retry-After` header, so clients may honor it when present but must not depend on it.
- **Degrade by source.** A PostHog failure must return a source-specific `unavailable` or, if explicitly stored, `stale` state. It must not manufacture zero. Payload-backed values can still succeed.
- **Expose provenance.** Each metric family needs a stable source, `asOf` timestamp, coverage statement, and freshness state. Consent-limited PostHog counts must be presented as observed marketing activity, not complete business totals.
- **Avoid synchronous refresh storms.** Cache misses or dashboard reloads must not fan out across tenants and periods. Request coalescing or a background refresh owner is required if a private aggregate cache or stored snapshot is chosen.
- **Keep observability aggregate-only.** Name production queries and record safe duration, status, cache state, range, and source. Do not log clinic identifiers, query credentials, event rows, or patient-linked properties.

## Load model for the architecture decision

The minimum capacity model is:

`uncached PostHog requests per minute = dashboard loads per minute × PostHog queries per load × retry multiplier`

With one query per load and no retry, the documented sustained hourly cap allows 2,400 loads per hour, averaging 40 per minute. Three concurrent queries impose a lower bound whenever execution slows. Fragmenting one page into six queries would reduce that theoretical budget to 400 loads per hour before any retries or other PostHog consumers.

This is a limit calculation, not a demand forecast. The project still needs expected active clinics, concurrent dashboard users, refresh behavior, and internal PostHog consumers before selecting direct reads, a private cache, PostHog materialization, or persisted aggregates.

## Open decisions and required follow-up evidence

1. Define the dashboard's p50 and p95 response target and the maximum source-specific staleness for 7-, 30-, and 90-day metrics.
2. Confirm the active PostHog plan, actual Query API limit generation, data-read usage, EU private API host, and availability of project secret API keys.
3. Decide whether PostHog aggregates are read live, cached privately, materialized inside PostHog, persisted in Payload, or combined through a tiered approach.
4. Verify why `patient_inquiry_created` is absent from the live schema and use Payload inquiries as the authoritative count regardless of the analytics result.
5. Define bot, automation, test-account, consent-coverage, and late-arriving-event semantics before customer-visible totals are named.
6. Repeat the benchmark through the real server adapter with production-equivalent credentials, representative event volume, known cache state, and concurrent loads. Record PostHog server timing and query-log read volume, not only end-to-end client time.
7. Exercise 429, 402, timeout, authentication, malformed-response, and network-failure paths against a non-production test boundary before accepting the failure contract.

## Sources

- [PostHog API queries](https://posthog.com/docs/api/queries)
- [PostHog API overview](https://posthog.com/docs/api)
- [PostHog Product Analytics API](https://posthog.com/docs/product-analytics/surfaces/api)
- [PostHog query optimization](https://posthog.com/docs/sql/optimizing-queries)
- [PostHog materialized views](https://posthog.com/docs/data-warehouse/views/materialize)
- [PostHog pricing](https://posthog.com/pricing)
- [findmydoc PostHog integration](../integrations/posthog.md)
- [findmydoc PostHog event registry](../../src/posthog/events.ts)
- [findmydoc PostHog event taxonomy ADR](../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [findmydoc Clinic Dashboard BFF ADR](../adrs/026-adr-standalone-clinic-dashboard-bff-architecture.md)
