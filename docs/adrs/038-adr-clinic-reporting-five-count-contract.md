# ADR: Version the five-count clinic reporting contract

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schuetze |
| Version | 1.0 |
| Date | 01.11.2026 |
| Status | Approved through Clinic Dashboard specification #299 |

## Background

ADR 029 defines the immutable V1 reporting contract. The approved [reporting specification](https://github.com/findmydoc-platform/clinic-dashboard/issues/299) requires five counts and browser recognition instead of session conversion. Website owns authorization, source access, calculation and time boundaries. Dashboard owns its session, BFF and presentation.

## Problem Description

Changing V1 in place would break deployed consumers. Session counts cannot identify unique visitors. Retention alone cannot prove that an event was captured throughout a reporting window, so missing instrumentation must not become a measured zero.

## Considerations

An in-place V1 change breaks its closed schema. A second endpoint duplicates authorization and routing. Explicit content negotiation on the existing scoped endpoint permits a compatible deployment while keeping the clinic-scope protocol independent.

## Decision with Rationale

Requests with `X-Findmydoc-Reporting-Contract: clinic-dashboard-reporting-v2` select V2. An absent header or explicit `clinic-dashboard-reporting-v1` retains V1 temporarily. Unknown versions fail privately with 400. `clinic-scope-v1` and per-request target-clinic authorization remain unchanged. Responses vary on Authorization and both contract headers and remain private, no-store.

V2 retains the V1 envelope, Istanbul calendar windows, count value/state/comparison rules and independent Payload review snapshots. Its closed metric catalog is `impressions`, `profileViews`, `uniqueVisitors`, `inquiryStarters`, `inquiries`, and `reviews`. It contains no session conversion, CTA counts or duplicate profile completeness. Published profile progress remains a separate capability.

Profile Views counts every matching `clinic_profile_viewed` event. Unique Visitors counts distinct nonempty browser `distinct_id` values among those events. Inquiry starters uses the same existing consent-controlled browser recognition for `clinic_inquiry_started`. Neither sessions, patient identifiers nor inquiry identifiers replace that recognition. Browser/device changes and cleared storage can count a person again; visitors without analytics consent are outside this population. No individual identities leave the source adapter.

The governed future event `clinic_inquiry_started` records a visitor's own substantive form edit, including invalid, incomplete or later deleted input. Opening, focus, scrolling, automatic or outside-form prefill and consent alone do not qualify. The governed future event `clinic_search_result_viewed` records a clinic result actually visible in the active viewport, once per result-view instance. Neither event captures field values, medical selections or contact content. Growth owns both events and PostHog is their target. Required property: `clinic_id`; no optional custom properties. Capture is implemented separately in #302/#303 after registration. No capture is introduced by this decision.

One consolidated PostHog query serves both windows, with a three-second total budget, no retry, no shared cache and no stale-result fallback. Each metric and window requires both retention and a verified capture-start instant. Unknown capture start or a window preceding it yields `partial_coverage`, without a number. Query/configuration failures yield `source_unavailable`. An available empty window is zero. Missing comparison coverage does not hide an available current value; percentage change with a zero comparison is null. Stored nonspam inquiries and current reviews remain independent Payload facts.

The server-only settings `POSTHOG_PROFILE_VIEWS_CAPTURE_STARTED_AT`, `POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT`, and `POSTHOG_INQUIRY_STARTERS_CAPTURE_STARTED_AT` record verified UTC capture starts. Unique Visitors shares the profile-view setting. Missing or invalid settings do not invent historical coverage. A first observed event is not evidence of continuous capture.

## Consequences

Deploy the V1-compatible Website producer checkpoint first, then the Dashboard V2 consumer, and only then a Website cleanup checkpoint after operational evidence confirms the deployed consumer switch. Source changes and controlled tests do not prove rollout. Dashboard changes its model, server validation, browser guard, controlled providers and fixtures together. V1 remains until #304 verifies all consumers switched. No collection, migration, aggregate, scheduler, identity linkage or new credential class is introduced. Local ClickHouse execution can prove emitted-query aggregation but cannot prove PostHog compiler, ingestion or rollout behavior.

## Technical Debt

Retire V1 only after the consumer inventory in #304. Establish verified capture starts during rollout; until then incomplete measurements remain partial. Historical obsolete events require the separate approved cleanup in #305.

## Superseded by (Optional)

None. This decision supersedes ADR 029 only for V2 metric catalog, visitor recognition and output. V1 remains unchanged during migration; its authorization, source isolation, time and privacy boundaries continue to apply.
