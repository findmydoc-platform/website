# ADR: Adopt tenant-safe five-count Clinic Dashboard reporting

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schuetze |
| Decision maker | Sebastian Schuetze |
| Version | 1.0 |
| Date | 01.11.2026 |
| Status | Superseded |

## Context

Clinic staff need reporting for the clinic they are currently authorized to access. Payload owns clinic identity,
participation and permissions. The Website/Payload application owns business sources and calculations; the separate
Clinic Dashboard owns its session, Backend for Frontend and presentation. Analytics measurements have different
coverage and failure modes from stored inquiry and review facts.

## Decision

Website/Payload exposes one purpose-specific, explicitly versioned reporting capability. Every request validates the
personal identity and authorizes its target clinic against current local or group access and participation. All source
reads use that clinic. Client-supplied roles, source choices and analytics identities grant no authority. Reporting
content negotiation remains independent of clinic-scope negotiation.

The reporting view contains Impressions, Profile Views, Unique Visitors, Inquiry starters and Inquiries. PostHog owns
the consent-limited event measurements. Payload owns stored nonspam inquiry counts and independent current review
snapshots. Published profile progress belongs to its separate profile capability. The Dashboard renders the returned
values and states without reconstructing business calculations or accessing the sources directly.

Profile Views counts repeated profile activity. Unique Visitors and Inquiry starters use the existing consent-controlled
browser recognition within each clinic and period. Patient, inquiry and session identifiers do not substitute for browser
recognition. An inquiry start requires a visitor's own substantive form edit. An impression requires a clinic result
actually visible in an active viewport. Analytics receives governed technical context, never form values, contact
content, medical selections or individual identities in reporting responses.

Reporting uses 7, 30 and 90 calendar-day periods in Europe/Istanbul, one shared as-of instant and an analogous preceding
comparison window. A value is available only when retention, verified capture start and the required recognition cover
its metric and window. Unknown or incomplete history has no numeric value. A fully covered window with no activity is
zero. Current and comparison availability are independent, and a zero comparison has no relative percentage change.
Capture provenance is project-specific; its storage format is an implementation detail.

Source failures remain isolated. One consolidated analytics query has a three-second total budget with no retry or stale
fallback. Available Payload facts remain usable during an analytics outage. Success and error responses are private and
not stored in a shared cache. The capability introduces no Reporting collection, durable aggregate or scheduled
calculation. Inquiry persistence, authorization, idempotency, audit and notifications remain independent of analytics.

## Rationale and consequences

Keeping authorization and source policy in Website/Payload gives both applications one business boundary. The closed
versioned contract keeps browser recognition, time boundaries and availability consistent across sources and display.
Direct reads avoid additional private-data storage and invalidation duties; they can produce explicitly unavailable or
partial metrics when a source or its history cannot establish a complete result.

The [API contract](../integrations/clinic-dashboard-api.md#clinic-dashboard-reporting-contract) defines the wire format.
[PostHog integration](../integrations/posthog.md#five-count-reporting-v2) defines event behavior and source configuration.
ADR 026 supplies the BFF boundary, ADR 023 the private-live classification and ADR 019 event governance.

## Superseded by

[ADR 039: Four-count Clinic Dashboard reporting](./039-adr-four-count-clinic-dashboard-reporting.md) supersedes this
record on 6 November 2026. The original V2 decision is preserved above.
