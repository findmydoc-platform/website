# ADR: Adopt four-count Clinic Dashboard reporting V3

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schuetze |
| Decision maker | Sebastian Schuetze |
| Version | 1.0 |
| Date | 06.11.2026 |
| Status | Approved |

## Background

[ADR 029](./029-adr-tenant-safe-clinic-dashboard-reporting.md) established the five-count V2 contract.
The reporting scope agreed on 6 November excludes Inquiry starters from clinic reporting while retaining internal
form-side analytics. Website and Dashboard validate a closed reporting contract, so field removal breaks V2 consumers.

## Problem Description

Clinic reporting must show Impressions, Profile views, Unique visitors and Inquiries in that order. Removing only the
card would leave an unused reporting capability. Removing form instrumentation would discard an explicitly retained
analytics function. Both applications need the same reduced contract.

## Considerations

Changing V2 in place obscures a breaking change and leaves existing strict consumers incompatible. A temporary V2/V3
compatibility window would permit staggered delivery but retain the unwanted reporting path during the transition.
The approved implementation plan selects an explicit V3 contract and a direct coordinated cutover without that window.

## Decision with Rationale

Supersede ADR 029 with `clinic-dashboard-reporting-v3`. The reporting header and response schema select V3 only.
The metrics object contains exactly `impressions`, `profileViews`, `uniqueVisitors`, `inquiries` and independent
`reviews`. Remove all inquiry-starters reporting queries, coverage, comparisons, DTO fields and presentation.
Retain the existing consent-controlled `clinic_inquiry_started` form capture, its typed registry and transport,
substantive-change trigger, readiness checks, property restrictions and privacy tests. No new event or trigger is added.

Retain ADR 029's authorization, source ownership, private-live responses, 7/30/90-day Istanbul periods, independent
coverage and comparison states, shared visitor recognition and isolated source failures. Analytics still uses one query
with a three-second budget and no retry or stale fallback. Payload inquiries count saved nonspam records independently.
The Dashboard owns its session and authorized BFF, validates V3, and performs no source calculations. Profile progress
remains independent. Order arrows do not express measured visitor conversion between these independent populations.

## Consequences

Deploy the Website V3 producer before the Dashboard V3 consumer in one coordinated platform release. Reporting can be
unavailable between deployments; old browser documents may need a reload. Do not add fallback requests, V2 adapters or
invented values. Rollback requires a matching pair of application versions. No database migration or environment change
is needed. Historical PostHog events remain intact; external dashboards and insights are outside this change.

A saved `inquiryStarters` display preference maps to `profileViews` in its valid original principal/clinic scope and
period. Both reporting views show four stages. The separate upper placeholder reduction is excluded.

Cache impact is `no-public-impact`. Only the existing authorized private reporting reads change. Public data reads,
write events, cache classes, tags and invalidation ownership are unchanged; read/write cache symmetry is not applicable.
Focused endpoint/BFF tests retain private no-store behavior and the source tests exercise the emitted query against
synthetic ClickHouse rows. Capture tests verify the retained exception. These checks do not prove a deployed rollout.

## Technical Debt

No V2 compatibility branch is retained. Historical references in closed decision records remain historical evidence.
