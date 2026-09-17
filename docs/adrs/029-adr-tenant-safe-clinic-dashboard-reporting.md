# ADR: Adopt a tenant-safe Clinic Dashboard reporting contract

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schuetze |
| Decision maker | Sebastian Schuetze |
| Version | 1.0 |
| Date | 17.09.2026 |
| Status | Approved |

## Background

An approved `clinicStaff` member needs a short reporting view for the clinic currently assigned to that principal. The
Version 1 (V1) view covers 7, 30, and 90-day periods. It combines authoritative facts stored in Payload with
consent-limited PostHog event data. The two sources do not have the same coverage or failure modes.

The Website and Payload application already owns the business API, database access, current `clinicStaff` resolution,
clinic approval, and tenant authorization. The separate Clinic Dashboard owns its Supabase session, same-origin
Backend for Frontend (BFF), and presentation. [ADR 026](./026-adr-standalone-clinic-dashboard-bff-architecture.md)
makes Payload the sole tenant and permission boundary. [ADR 023](./023-adr-public-website-cache-and-revalidation-strategy.md)
classifies authenticated Dashboard reads as `private-live` and excludes persistent public caches.
[ADR 019](./019-adr-posthog-event-taxonomy-and-usage-governance.md) limits PostHog to governed, privacy-reviewed event
data.

The reporting decisions are recorded in [Website issue #1858](https://github.com/findmydoc-platform/website/issues/1858)
and the [reporting Wayfinder map](https://github.com/findmydoc-platform/management/issues/376). This record fulfils
[Website issue #1861](https://github.com/findmydoc-platform/website/issues/1861) before the Website/Payload contract
and Dashboard presentation are implemented in separate repositories.

## Problem Description

Without a focused contract, the Dashboard could reconstruct a clinic scope, select a reporting source, or turn an
unavailable source into a misleading zero. A generic Dashboard-to-Payload interface would also leak Payload structure
into the BFF and blur the boundary set by ADR 026. Adding a cache or a stored aggregate before an observed production
need would add invalidation and retention duties to a private read that has no such requirement in V1.

The contract must keep one clinic's information isolated from every other clinic, distinguish complete values from
unknown values, and make its time boundaries stable for clinics in Türkiye.

## Decision Drivers

- Payload must resolve the tenant from the current approved `clinicStaff` principal on every request.
- The Dashboard must not choose an authoritative clinic, role, actor, source, timezone, or metric semantics.
- Stored inquiry facts and current profile facts remain Payload facts. Consent-limited event measurements remain
  PostHog facts.
- A source failure or incomplete source coverage must never appear as `0`.
- V1 must support only 7, 30, and 90 calendar-day reporting periods in `Europe/Istanbul`.
- Authenticated reporting remains `private, no-store`; V1 has no request-crossing cache or stale-result fallback.
- V1 needs no new schema, migration, Reporting collection, durable aggregate, or scheduled reporting job.

## Considerations

### Let the Clinic Dashboard assemble reporting

The Dashboard could choose the clinic, query Payload and PostHog, and compose its own view. That duplicates
authorization and source policy outside Payload, exposes more server credentials, and makes tenant isolation dependent
on two applications. Rejected.

### Add reporting to bootstrap or expose a generic Payload proxy

The existing bootstrap is a small principal and capability projection. Expanding it into reporting, or forwarding
generic Payload requests through the BFF, would make a stable, purpose-specific capability into a broad data endpoint.
It conflicts with ADR 026. Rejected.

### Add a focused Website/Payload reporting endpoint

Website/Payload can authorize the current principal, derive the clinic, compute the reporting period, call each source,
and return a purpose-specific DTO. The Dashboard can then forward that DTO through its BFF and render the returned
availability states. Chosen.

### Cache or precompute reporting data

A shared cache, Redis, Vercel Runtime Cache, a Reporting collection, durable aggregates, or a scheduled job could
reduce source reads. Each option creates private-data freshness, invalidation, persistence, or retention work before a
measured live problem exists. Rejected for V1.

## Decision with Rationale

### Ownership and authorization

The Website/Payload application owns the reporting contract, source access, authorization, reporting semantics, and
tenant boundary. It exposes one focused read capability at `GET /api/clinic-dashboard/reporting?periodDays=7|30|90`.
The response is a purpose-specific data transfer object (DTO). The request has no body and accepts exactly one
`periodDays` query value: `7`, `30`, or `90`. Missing, repeated, non-integer, unknown, or additional query values fail
with the endpoint's private invalid-input response.

Every request validates the Bearer token and resolves the current `clinicStaff` record through the existing current
access-state path. The server then derives the clinic from that approved staff record. A missing token or unresolved
principal returns `401`; an unapproved staff member, an unsynchronized staff record, a missing clinic assignment, an
unapproved clinic, or a deleted clinic returns `403` without reporting data. A client-supplied clinic ID, role, actor,
source, or timezone has no authority and must not affect the result.

The Clinic Dashboard owns only its session, BFF forwarding, and display states. It never calls Payload or PostHog from
browser code, never stores a Reporting result as business data, and never extends the Website/Payload DTO with business
rules. This capability is not a generic Payload proxy and does not expand the bootstrap DTO.

### Normative wire contract

This section is the normative V1 wire contract. It is not an example and it is not a future design task. Website issue
#1862 implements it without adding, removing, renaming, or making fields optional. Clinic Dashboard issue #151 consumes
only this version. No agent may infer or invent a field from runtime code, an existing Dashboard fixture, or a PostHog
response.

The request has an `Authorization: Bearer <token>` header and the one `periodDays` query value. It has no authoritative
clinic, role, actor, source, timezone, metric, or correlation field. Such fields are neither accepted as query values
nor read from a request body. The server derives the clinic, authorization, timezone, sources, and metric semantics.

All successful responses have this immutable top-level shape. Every listed field is present. `InstantUtc` is an ISO 8601
UTC instant with exactly three fractional-second digits and a `Z` offset, matching
`YYYY-MM-DDTHH:mm:ss.SSSZ`. `asOf` and `period.to` are the same instant. Numeric values are finite JSON numbers. Count
values are non-negative integers. Percentage values are numbers from `0` through `100`.

```ts
type ReportingSchemaVersion = 'clinic-dashboard-reporting-v1'
type MetricSource = 'payload' | 'posthog'
type SourceState = 'available' | 'source_unavailable' | 'partial_coverage'
type SessionConversionState = SourceState | 'zero_denominator'
type ReviewAverageState = SourceState | 'no_reviews'
type MetricState = SourceState | 'zero_denominator' | 'no_reviews'
type InstantUtc = string // YYYY-MM-DDTHH:mm:ss.SSSZ
type PeriodDays = 7 | 30 | 90

type MetricValue = {
  value: number | null
  state: SourceState
}

type CountMetric = {
  source: MetricSource
  current: MetricValue
  comparison: MetricValue & {
    absoluteDelta: number | null
    relativeDeltaPercent: number | null
  }
}

type SessionConversionMetric = {
  source: 'posthog'
  current: {
    ratePercent: number | null
    numeratorSessions: number | null
    denominatorSessions: number | null
    state: SessionConversionState
  }
  comparison: {
    ratePercent: number | null
    numeratorSessions: number | null
    denominatorSessions: number | null
    state: SessionConversionState
    percentagePointDelta: number | null
  }
}

type SnapshotNumber<State extends MetricState> = {
  source: 'payload'
  value: number | null
  state: State
  comparison: null
}

type ClinicDashboardReportingV1 = {
  schemaVersion: ReportingSchemaVersion
  asOf: InstantUtc
  timezone: 'Europe/Istanbul'
  period: { days: PeriodDays; from: InstantUtc; to: InstantUtc }
  comparisonPeriod: { days: PeriodDays; from: InstantUtc; to: InstantUtc }
  metrics: {
    profileViews: CountMetric & { source: 'posthog' }
    ctaInteractions: {
      source: 'posthog'
      total: CountMetric & { source: 'posthog' }
      byCtaId: {
        choose_treatment: CountMetric & { source: 'posthog' }
        contact: CountMetric & { source: 'posthog' }
        contact_doctor: CountMetric & { source: 'posthog' }
      }
    }
    inquiries: CountMetric & { source: 'payload' }
    sessionConversion: SessionConversionMetric
    reviews: {
      source: 'payload'
      count: SnapshotNumber<SourceState>
      average: SnapshotNumber<ReviewAverageState>
    }
    profileCompleteness: {
      source: 'payload'
      completedAreas: number | null
      totalAreas: 6
      percent: number | null
      state: SourceState
      comparison: null
    }
  }
}
```

`comparisonPeriod` always represents the immediately preceding period of the same number of local calendar days.
`CountMetric.comparison` represents the same metric for that period. Its `absoluteDelta` is `current.value -
comparison.value`; its `relativeDeltaPercent` is null when either value is null or the comparison value is zero.
`SessionConversionMetric.comparison.percentagePointDelta` is null unless both rates are available. Snapshot metrics
always carry `comparison: null`. `reviews.average` uses `no_reviews` when the count is zero. `profileCompleteness` uses
`available` only when all six areas were resolved; otherwise its numeric fields are null with the applicable source
state.

Nullability is state-bound, not optional: every property above is emitted, including properties whose value is null.
`MetricValue.value`, snapshot `value`, and profile-completeness numeric fields are numbers only for `available`; they
are null for `source_unavailable` and `partial_coverage`. A session metric has numeric rate, numerator, and denominator
only for `available`; it has all three null for a source state and exactly `ratePercent: null`,
`numeratorSessions: 0`, and `denominatorSessions: 0` for `zero_denominator`. A `no_reviews` average has `value: null`;
its paired review count is `available` with `value: 0`. All delta fields are numbers only when their required current
and comparison values are available; otherwise they are null. No key is omitted to signal availability, coverage, or a
zero value.

The only error response shape is `{ error: { code, message } }`. Both fields are always present and strings. The code
and fixed, safe message are one of the following. The response never contains an upstream URL, exception, provider
detail, principal detail, clinic identifier, or retry instruction.

| Status | `error.code` | `error.message` | When it applies |
| --- | --- | --- | --- |
| 400 | `CLINIC_DASHBOARD_REPORTING_INVALID_INPUT` | `Reporting period must be 7, 30, or 90 days.` | The request shape or `periodDays` value is invalid. |
| 401 | `CLINIC_DASHBOARD_UNAUTHORIZED` | `Authentication is required.` | The Bearer token is missing, invalid, or cannot resolve a `clinicStaff` principal. |
| 403 | `CLINIC_DASHBOARD_ACCESS_DENIED` | `Reporting access is not available.` | The resolved principal or clinic is not currently eligible. |
| 503 | `CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE` | `Reporting is temporarily unavailable.` | Token validation or current-principal and tenant resolution cannot finish safely. |

A metric-source outage after authorization and tenant resolution is not a `503`. The endpoint returns `200` with the
complete V1 DTO, using `null` and `source_unavailable` or `partial_coverage` for each affected metric. It preserves
independent successful metrics in that same response.

### Period and timezone contract

V1 accepts exactly 7, 30, and 90 local calendar-day periods. The Website captures one request-local `asOf` instant,
resolves the reporting timezone, and returns `timezone`, `from`, `to`, and `asOf` in the DTO. The current local day is
included only through `asOf`. The period begins at the first instant of the local day `periodDays - 1` days before the
`asOf` local date. Source queries convert those local boundaries to Coordinated Universal Time (UTC). A comparison period is the immediately
preceding local calendar block of the same length and ends at the equivalent local clock time.

V1 is limited to Türkiye. The server resolves every V1 clinic's existing `address.country` relationship with ISO code
`TR` to the single Internet Assigned Numbers Authority (IANA) timezone `Europe/Istanbul`. It does not accept a clinic
timezone from the client, add a `reportingTimezone` field, create a portal setting, backfill data, or run a migration.
Supporting a country with more than one IANA timezone requires a new decision, an explicit clinic timezone field, and a
migration before that country is enabled for reporting.

### Sources, coverage, and failure states

Payload is authoritative for stored inquiry counts and current profile facts. PostHog supplies only consent-limited
event measurements. The closed V1 catalog is:

- `profileViews`, the count of `clinic_profile_viewed` events. Repeated events count.
- `ctaInteractions`, the count of `clinic_cta_clicked` events, both total and by the stable call-to-action (CTA)
  `cta_id` values `choose_treatment`, `contact`, and `contact_doctor`. CTA labels and locations are not reporting
  categories.
- `inquiries`, the Payload count of `PatientClinicInquiry` records by `createdAt`. It includes `submitted`,
  `in_review`, `contacted`, and `closed` records, excludes spam, and is not an open-case count.
- `sessionConversion`, the consent-limited unique-session funnel
  `clinic_profile_viewed -> patient_inquiry_created`. Both events must carry the server-derived `clinic_id` and the
  same PostHog `$session_id` in that order. Each session counts once. CTA interaction is not a funnel step.
- `reviews`, the current count and average of public, approved reviews that are neither deleted nor withdrawn. Pending
  and rejected reviews are excluded. This is an `asOf` snapshot, not a period metric.
- `profileCompleteness`, the current published six-area Clinic Dashboard profile state. This is an `asOf` snapshot,
  not a period metric.

The funnel does not claim patient identity, appointment conversion, booking, reservation, treatment outcome, or a
cross-session browser identity. `distinct_id` and `$session_id` exist only for analytics correlation. The
server-created `patient_inquiry_created` event is emitted only after durable inquiry storage succeeds.

The only browser-to-server correlation input is one optional `session_id` string on a clinic-inquiry form submission.
The browser reads it only after analytics consent and attaches it only to that submission. It must match
`^[A-Za-z0-9_-]{1,128}$`; the browser omits it when consent is absent or the value is unavailable. No other analytics
identifier, including `distinct_id`, is accepted by the form bridge.

The form bridge validates this input as ephemeral analytics data. It does not log, persist, return, or use it for
authorization, tenant selection, or inquiry storage. Only after durable inquiry storage succeeds may the bridge forward
the validated value as the PostHog `$session_id` on the server-side `patient_inquiry_created` event. The server derives
that event's `clinic_id` from the stored inquiry or its server-validated clinic record, never from browser form data.

For public profile views, the browser analytics event receives its clinic label from canonical server-rendered clinic
page props. That label is measurement-only. It is never an authorization or tenant input. The reporting DTO never
returns `session_id`, `$session_id`, or `distinct_id`, and none of them may establish identity across sessions. Missing,
invalid, or censored session correlation makes `sessionConversion` `partial_coverage`; it never produces a false zero.

Each numeric metric carries its source and a value state. A metric value is a number only when that source supplied
complete coverage for the requested period. `0` means the complete source calculated zero. It never represents a
failed, missing, or partial source.

The availability states are:

| State | Value | Meaning |
| --- | --- | --- |
| `available` | number | The metric's source completed for the requested period. |
| `source_unavailable` | `null` | The source could not be read or its request budget expired. |
| `partial_coverage` | `null` | The source responded, but its retained or consent-limited data does not cover the requested metric and period. |
| `zero_denominator` | `null` | A rate has no complete profile-view session denominator. |
| `no_reviews` | `null` | A review average has no public, approved review. |

Payload and PostHog fail independently. When PostHog fails, Payload-backed values remain available when their Payload
reads succeed. A PostHog-backed metric becomes `null` with `source_unavailable`; the response does not fail over to
Payload, reconstruct a value, return a prior value, or substitute `0`. When source coverage is incomplete, each
affected metric becomes `null` with `partial_coverage`. A comparison appears only when every source required for that
comparison is `available` for both periods. Count deltas may be absolute and relative. A zero count baseline makes a
relative delta unknown. Session-conversion comparisons use percentage-point deltas.

The PostHog adapter makes at most one consolidated query for one Dashboard load. The full PostHog work has a three
second budget and does not retry within that request. This is an implementation limit, not a production performance
service-level objective. The adapter returns only the agreed aggregate values and availability state. It never exposes
PostHog credentials, raw events, browser identifiers, patient data, inquiry free text, medical content, or
authorization internals.

### Cache, storage, and operational boundary

Reporting is authenticated `private-live` data under ADR 023. Every success and error response uses exactly
`Cache-Control: private, no-store`, `Pragma: no-cache`, `Expires: 0`, and `Vary: Authorization`. This V1 contract has
no request header for contract negotiation.

V1 adds no browser cache, content delivery network (CDN) cache, public Next.js cache, Vercel Data Cache, Redis,
Runtime Cache, other request-crossing cache, stale-result reserve, durable reporting aggregate, Reporting collection,
or scheduled job. Request-local deduplication is allowed only inside one authenticated request. Logging source failures
may use the existing structured logging boundary, but reporting reads do not create PostHog product events.

### Scope boundaries

V1 excludes browser-to-Payload reporting access, browser-held PostHog credentials, a generic Dashboard-to-Payload
proxy, countries outside Türkiye, clinic-configured timezones, bookings, reservations, appointments, patient-level
analytics, medical content, inquiry free text, and cross-session identity reconstruction. It also excludes a
predefined performance service-level objective or cache infrastructure.

ADR 028 remains the accepted decision for transactional email. This ADR neither changes nor supersedes it.

## Consequences

- **Positive:** Payload remains the single tenant and authorization boundary, so a Dashboard request cannot select a
  different clinic.
- **Positive:** The Dashboard receives one small contract with explicit unknown-data states instead of guessing from
  raw source responses.
- **Positive:** Source failures stay isolated. An unavailable PostHog query does not hide successful Payload facts.
- **Negative:** Website/Payload must keep the metric catalog, source adapters, DTO, and endpoint tests synchronized
  with the Dashboard contract.
- **Negative:** Direct PostHog reads can make a reporting response slower or partially unavailable. V1 accepts that
  tradeoff rather than serving stale data or introducing a cache without evidence.
- **Negative:** The Türkiye-only timezone rule blocks reporting for future multi-timezone countries until a successor
  decision and migration exist.
- **Neutral:** Request-local source deduplication is permitted, but it creates no reusable cache entry or invalidation
  responsibility.

## Implementation Plan

The two implementation tickets are deliberately split by repository. The Website/Payload work is
[Website issue #1862](https://github.com/findmydoc-platform/website/issues/1862). The BFF and user interface work is
[Clinic Dashboard issue #151](https://github.com/findmydoc-platform/clinic-dashboard/issues/151).

### Website and Payload, issue #1862

- **Affected areas:** create one dedicated reporting handler beside the existing
  `src/endpoints/clinicDashboardBootstrap.ts` and one cohesive reporting module beside
  `src/features/clinicDashboard/bootstrap.ts`; register the focused `GET /clinic-dashboard/reporting` endpoint in
  `src/payload.config.ts`; update `src/posthog/events.ts`, `src/posthog/client.ts`, and
  `src/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client.tsx` with the session-correlation contract;
  update `src/app/api/form-bridge/[slug]/route.ts` so the successful server-side inquiry event preserves the validated
  analytics correlation data; add endpoint and module tests beside
  `tests/unit/endpoints/clinicDashboardBootstrap.test.ts`. Do not edit
  `docs/integrations/clinic-dashboard-api.md` in this ADR-only change. After the endpoint exists and its contract tests
  pass, issue #1862 copies the normative wire contract above into that integration document without semantic changes.
- **Dependencies:** V1 uses the existing Payload, Zod, and PostHog dependencies. Do not add a cache, queue, database,
  or browser analytics dependency to implement reporting.
- **Authorization pattern:** reuse the Bearer validation and current-principal checks in
  `src/features/clinicDashboard/bootstrap.ts` and `src/features/clinicDashboard/authorization.ts`. Resolve the clinic
  through `readClinicAccessState` in `src/auth/utilities/clinicAccessState.ts` for every request. Do not trust a
  query parameter or reuse a clinic assignment from an earlier request.
- **Response pattern:** follow the private-response values in
  `src/endpoints/clinicDashboardBootstrap.ts`, but do not reuse its negotiated-contract `Vary` value unchanged. The
  reporting handler emits the exact V1 headers and every success or error shape defined in the normative wire contract.
  Parse `periodDays` as the endpoint's only query parameter and reject unknown or repeated parameters.
- **Payload-source pattern:** query the minimum fields from `patientClinicInquiries`, `reviews`, and `clinics` through
  the Payload request context. Scope every query to the resolved clinic and local period when the metric is periodic.
  Return projections and aggregate values, never collection documents or inquiry text.
- **PostHog-source pattern:** add a server-only reporting adapter inside the new reporting module. It reads only
  governed fields from `src/posthog/events.ts`, applies the consent and retention limits, combines the required metric
  reads into one query, and enforces the three-second, no-retry request budget. Any query credential remains
  server-only and is not named `NEXT_PUBLIC_*`. Extend the public profile event only from canonical server-rendered
  clinic props. Extend the clinic-inquiry form and form bridge with the one optional, bounded `session_id` input from
  the normative contract. The bridge validates it without logging, persisting, or returning it, then forwards it only
  after durable inquiry storage to the server event. The server derives the event clinic from the stored inquiry or
  validated record, never from browser form data.
- **Configuration:** document and provision a server-only PostHog query credential for the Website runtime. Do not put
  it in a browser bundle, DTO, log field, or Dashboard environment setting.
- **Migration:** none. V1 adds no collection, schema field, payload type regeneration, data backfill, or migration.
- **Timezone pattern:** keep the V1 `TR` to `Europe/Istanbul` resolver in the reporting module. Read the existing
  `clinics.address.country` relationship and `countries.isoCode`; do not edit `src/collections/Clinics.ts`,
  `src/collections/Countries.ts`, `src/payload-types.ts`, or `src/migrations/`.
- **Patterns to avoid:** do not add a reporting capability to bootstrap merely to authorize this read; do not add a
  generic proxy, cache tag, revalidation owner, cache store, collection, migration, job, stale fallback, or a
  second source pretending to be the failed source.

### Clinic Dashboard, issue #151

- **Affected areas:** add a purpose-specific server-side client and same-origin BFF route in the Clinic Dashboard
  repository. It forwards the authenticated request to the Website/Payload endpoint and preserves the exact
  `clinic-dashboard-reporting-v1` response and private-header contract.
- **Presentation pattern:** render the returned timezone, period, available values, `source_unavailable`, and
  `partial_coverage` states as distinct states. Render `0` only when the Website/Payload DTO says the metric is
  `available` with value `0`. Do not add, omit, rename, or derive contract fields and do not expose analytics
  correlation identifiers.
- **Patterns to avoid:** do not send a clinic, role, actor, source, timezone, metric definition, or PostHog
  credential as authority. Do not add a Dashboard database, durable cache, or business calculation.

### Verification

- [ ] `GET /api/clinic-dashboard/reporting` accepts only one `periodDays` value of `7`, `30`, or `90`; all other
  query shapes return the private invalid-input response.
- [ ] Contract tests assert the complete, immutable `clinic-dashboard-reporting-v1` JSON shape, including every
  required field, allowed enum, null field, UTC instant format, period, comparison period, metric, breakdown, snapshot,
  and comparison representation.
- [ ] Contract tests assert the four exact error envelopes, statuses, codes, safe messages, and headers. They also
  prove that a metric-source outage returns `200` with the complete DTO and metric-level `null` state, not an endpoint
  error.
- [ ] An invalid or missing Bearer token returns `401`, and an unapproved, unsynchronized, unassigned, deleted, or
  otherwise unauthorized clinic principal returns `403` without a reporting DTO.
- [ ] Tests prove that query or body values for clinic, role, actor, source, or timezone cannot change the
  server-derived clinic or reporting timezone.
- [ ] Tests freeze an `asOf` instant and prove the 7, 30, and 90-day period boundaries use `Europe/Istanbul` and an
  `asOf`-bounded current local day, then prove the prior comparison period uses the equivalent local clock boundary.
- [ ] Tests prove that an approved Türkiye clinic resolves from the existing country relationship to
  `Europe/Istanbul`, with no new clinic timezone field, schema change, or migration.
- [ ] Tests prove that every success and error response has `Cache-Control: private, no-store`, `Pragma: no-cache`,
  `Expires: 0`, and an `Authorization` `Vary` value.
- [ ] Tests prove that each Payload query is constrained by the current resolved clinic and that one principal cannot
  receive another clinic's facts.
- [ ] Tests prove that a PostHog failure returns affected PostHog values as `null` with `source_unavailable`, keeps
  successful Payload values, makes no same-request retry, and does not return a stale value or `0`.
- [ ] Tests prove that incomplete PostHog retention or consent coverage returns `null` with `partial_coverage` and
  suppresses dependent comparisons.
- [ ] Tests prove that `0` occurs only for an `available` metric with a complete source result.
- [ ] Contract tests cover the closed V1 metric catalog, the spam exclusion from `inquiries`, current-only `reviews`
  and `profileCompleteness`, a `zero_denominator` session rate, and `no_reviews` for a review average.
- [ ] Synthetic analytics tests prove that the funnel counts each matching clinic session once, excludes a different
  clinic or event order, and never uses `distinct_id` as cross-session identity.
- [ ] Browser and form-bridge tests prove that the only accepted correlation input is a consent-gated `session_id`
  matching `^[A-Za-z0-9_-]{1,128}$`, attached only to a clinic-inquiry submission. They prove that it is neither
  logged, persisted, returned, nor used to choose a clinic, then reaches the server PostHog event only after durable
  inquiry storage.
- [ ] Tests prove that the profile-view clinic label comes from canonical server-rendered clinic props, the inquiry
  event clinic comes from the stored or validated clinic record, and missing, invalid, or censored correlation yields
  `sessionConversion` with `partial_coverage` rather than `0`.
- [ ] Tests prove that one Dashboard load makes at most one consolidated PostHog query and respects its three-second
  request budget.
- [ ] A structural check confirms that V1 adds no `reporting` Payload collection, migration, scheduled job,
  request-crossing cache, cache tag, cache invalidation, Redis, Runtime Cache, or browser-visible PostHog credential.
- [ ] Clinic Dashboard tests cover BFF forwarding and normal, `source_unavailable`, and `partial_coverage` rendering
  states against the exact `clinic-dashboard-reporting-v1` DTO.

## Relationship to Existing Decisions

- ADR 023 supplies the `private-live` classification and no-store cache rule. This ADR applies that boundary to one
  additional focused authenticated read; it creates no public cache or invalidation behavior.
- ADR 026 supplies the BFF, session, and Payload authorization boundary. This ADR adds one capability-specific
  Website/Payload contract inside that boundary.
- ADR 019 governs the PostHog events and privacy limits used by the contract. It does not make PostHog authoritative
  for Payload facts.
- ADR 028 remains unchanged and governs transactional email only.

## Technical Debt

V1 deliberately accepts direct source reads and the limited historical coverage available from PostHog. If observed
production load, a retention need, or a country with multiple timezones requires a different design, open a successor
ADR before adding a cache, aggregate, scheduled job, broader timezone model, or identity linkage.

## More Information

- [Website issue #1821](https://github.com/findmydoc-platform/website/issues/1821) records why this is a new ADR rather
  than an edit to ADR 023 or ADR 026.
- [Website issue #1769](https://github.com/findmydoc-platform/website/issues/1769) records the V1 metric catalog and
  value semantics.
- [Website issue #1782](https://github.com/findmydoc-platform/website/issues/1782) records the required
  consent-limited session-correlation path for the funnel.

## Risks

- A new metric could mix Payload and PostHog semantics.
  - Mitigation: keep the metric catalog closed, label every metric with its source and availability, and require a
    contract and Dashboard update for each addition.
- A Dashboard implementation could display an unknown value as zero.
  - Mitigation: preserve the `null` plus availability state through the BFF and test the visible states in issue #151.
- A PostHog outage could make part of the view unavailable.
  - Mitigation: isolate source failures, return successful Payload facts, and do not invent a fallback value.
- Future geography could make the Türkiye timezone shortcut incorrect.
  - Mitigation: block new countries until a successor ADR specifies clinic-level timezone data and migration work.

## Superseded by

Not superseded.
