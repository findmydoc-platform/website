# Clinic Dashboard funnel and comparison semantics

## Scope and method

This note resolves which funnel and comparison claims the Clinic Dashboard can support with the current Website events. It reviews the repository contracts and PostHog's official documentation and source as available on 5 September 2026. It does not query the live PostHog project, inspect real visitors, or choose a conversion window from production data.

The distinction matters. A funnel follows the same actor or session through ordered steps. A ratio divides aggregate series. Both can be useful, but they answer different questions and must not share a label.

## Recommendation

V1 should expose independent activity metrics and, if a directional relationship is still wanted, a clearly typed PostHog event ratio. It should not expose a field named `funnel` or `conversionRate` yet.

- Keep `profileViews` and `ctaInteractions` as total event counts from PostHog's consent-limited population.
- Keep stored inquiry count as the authoritative Payload metric.
- If retained, calculate `patient_inquiry_created / clinic_profile_viewed` only inside PostHog. Name it `profileViewToInquiryEventRatio`, declare `kind: event_ratio`, and state that it may exceed 100%. Never divide Payload inquiries by PostHog profile views.
- Keep CTA totals and the stable `cta_id` breakdown outside the headline ratio. A CTA is a route a visitor may take, not a required step before every valid inquiry.
- Add a true session funnel only after the browser and server events carry the same session identity. The headline funnel should then be `clinic_profile_viewed -> patient_inquiry_created`, sequential and clinic-filtered. A separate diagnostic funnel may add `clinic_cta_clicked` as its middle step.
- Do not adopt PostHog's default conversion window as a product decision. Select the window from the observed time-to-inquiry distribution after identity continuity is fixed. Until then, the reporting contract should mark the conversion window as unresolved rather than silently using a vendor default.

This recommendation changes one earlier working assumption: `patient_inquiry_created / clinic_profile_viewed` is not a Profile-to-Inquiry conversion rate. With total event aggregation it is inquiries per tracked profile-view event.

## What PostHog measures

### Funnels follow actors through events

PostHog describes a funnel as a flow that starts with an event, ends with a success event, and counts people who complete the intervening steps. Its default sequential order requires step B after step A but permits unrelated events between them. Strict order permits no intervening event, while any-order funnels ignore sequence. Repeating the same event as two steps requires two distinct occurrences. These rules make a funnel an ordered actor-level analysis, not division of aggregate event totals ([PostHog funnel steps and ordering](https://posthog.com/docs/product-analytics/funnels#adding-steps)).

PostHog supports overall conversion relative to the first step and relative conversion between adjacent steps. It also lets a query choose the first-ever event or the first occurrence matching the step filters when an actor repeats an event ([PostHog funnel conversion](https://posthog.com/docs/product-analytics/funnels#conversion-rate-calculation), [PostHog repeated-event matching](https://posthog.com/docs/product-analytics/funnels#filtering-for-first-occurrence)).

PostHog's query schema has a separate `funnelAggregateByHogQL: properties.$session_id` option for unique-session funnels. The same schema gives funnel queries an explicit conversion-window value and unit, with a 14-day vendor default ([PostHog funnel query schema](https://github.com/PostHog/posthog/blob/master/frontend/src/queries/schema/schema-assistant-queries.ts)). The default is a software default, not evidence that 14 days matches the clinic inquiry journey.

Historical funnel trends group actors by when they entered the funnel. PostHog recommends hiding incomplete periods when entrants have not yet had the full conversion window to finish ([PostHog historical funnel trends](https://posthog.com/docs/product-analytics/funnels#graph-type)). This is right-censoring in product terms: a recent entrant can look like a drop-off only because their allowed time has not elapsed.

### Event ratios divide volumes

PostHog Trends distinguishes total event count, unique users, and unique sessions. Total count is the number of times an event occurred, while unique-user and unique-session aggregations deduplicate on their respective entity ([PostHog trend aggregations](https://posthog.com/docs/product-analytics/trends/aggregations#event-aggregation)). Trend formulas can divide series A by series B at each point in time ([PostHog formulas](https://posthog.com/docs/product-analytics/trends/formulas)).

Therefore, `total(patient_inquiry_created) / total(clinic_profile_viewed)` is an event-volume ratio. It does not require the numerator events to come from actors who contributed denominator events. It does not enforce order or a conversion window. Multiple inquiries, repeated views, missing views, or a change in capture behavior can move it above 100%. None of that is a PostHog error. It follows from the chosen aggregation.

### Identity continuity is part of the measurement contract

PostHog requires applications to coordinate identity across browser and server environments. Its current guidance says that different IDs for the same person fragment downstream funnels and that PostHog cannot infer that two IDs belong together. It recommends carrying the same stable ID across transitions or linking IDs explicitly ([PostHog identity resolution](https://posthog.com/docs/product-analytics/identity-resolution)). For server capture, the identification guide tells applications to use the same `distinct_id` as the frontend. It also recommends carrying the browser session ID into backend events when those events must belong to the same session ([PostHog client-to-server identity](https://posthog.com/docs/product-analytics/identify#carried-to-the-backend)).

A tracked-browser identity is still not proof of a unique human. Browser storage can be cleared, one person can use several devices, and several people can share a device. A future cross-session funnel should therefore use the label `tracked browser`, unless findmydoc later has a lawful and reliable person identity for this public journey ([PostHog identity layers](https://posthog.com/docs/product-analytics/identity-resolution#the-identity-layer-model)).

### Consent limits the observed population

PostHog provides complete opt-out controls that stop data capture for opted-out users ([PostHog privacy controls](https://posthog.com/docs/product-analytics/privacy#complete-opt-out)). The Website applies its own analytics-consent gate to both browser and server business events. As a result, PostHog describes only consent-eligible captured activity. It cannot establish total profile traffic or total inquiries, and its observed conversion behavior must not be extrapolated to people who did not consent.

`consent_limited` is a population qualifier, not an outage state. A query can succeed with complete technical coverage and still represent only that selected population.

## Repository evidence

The three relevant events share `clinic_id` and `clinic_slug`, which permits a server-derived clinic filter on every step. Their capture paths differ:

| Event | Capture path | Repetition and identity behavior |
| --- | --- | --- |
| `clinic_profile_viewed` | Browser, after analytics capture is enabled | `src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx`, lines 112-126, attempts one capture per mounted component and clinic tracking key. It records the key before checking whether capture succeeded. A late consent change does not trigger a retry for that mounted view. |
| `clinic_cta_clicked` | Browser, after analytics capture is enabled | `src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx`, lines 128-143, captures each tracked click. Repeated clicks remain repeated events. |
| `patient_inquiry_created` | Server, after successful form persistence and analytics consent | `src/app/api/form-bridge/[slug]/route.ts`, lines 142-176, captures after submission and passes a submission-derived fallback actor ID. |

PostHog cannot reliably join the current browser and inquiry events into an actor-level or session-level funnel. `src/posthog/api.ts`, lines 174-192, chooses `fallbackAnonymousId` before the PostHog cookie ID. The form bridge supplies `form_submission:<submissionId>` whenever it has a submission ID. The inquiry event also carries no `$session_id`. Browser profile views and CTA clicks therefore use browser SDK identity, while a successful inquiry normally uses a submission identity.

There is a second asymmetry. `src/posthog/client.ts`, lines 118-132, returns `false` when browser capture is not initialized or enabled. The profile component has already marked that view as tracked before it calls the facade. A visitor who grants consent after the component's first attempt can later produce a consent-eligible inquiry event without a corresponding profile-view event from that mounted visit.

These facts do not invalidate the event totals. They invalidate the stronger claim that the existing events describe the same actor moving through a sequence.

## Reporting contract

### Metric types and names

The API should make measurement type explicit instead of asking the Dashboard to infer it from labels:

| Metric | Source and aggregation | Contract meaning |
| --- | --- | --- |
| `profileViews` | PostHog total count of `clinic_profile_viewed` | Captured profile-view events, consent-limited. Not unique visitors. |
| `ctaInteractions.total` | PostHog total count of `clinic_cta_clicked` | Captured CTA-click events, consent-limited. |
| `ctaInteractions.byCtaId` | Same events grouped by stable `cta_id` | Directional route detail. Labels and positions are presentation properties, not metric identities. |
| `inquiries` | Payload count by accepted inquiry creation time and agreed status rules | Authoritative stored business-event count. Not consent-limited. |
| `profileViewToInquiryEventRatio` | PostHog total `patient_inquiry_created` divided by total `clinic_profile_viewed` | Optional directional event ratio. May exceed 1. Not a funnel or unique-actor conversion rate. |

The optional ratio should carry at least:

```json
{
  "kind": "event_ratio",
  "population": "consent_limited",
  "numerator": "patient_inquiry_created.total_count",
  "denominator": "clinic_profile_viewed.total_count",
  "value": 0.12,
  "reason": null
}
```

The Dashboard may format `0.12` as `12%`, but its copy should say "inquiries per tracked profile view". It should not say "12% of visitors converted".

### Null, zero, and coverage

Each source-backed value needs a status in addition to its numeric value:

- Return `0` only after the source query succeeds and the requested technical coverage is complete.
- Return `null` with `source_unavailable` when the source cannot answer.
- Return `null` with `partial_coverage` when the requested period crosses a known instrumentation boundary, outage, or incomplete source interval.
- Return an event ratio of `null` with `zero_denominator` when the profile-view count is zero.
- Propagate an unavailable or partial status from either ratio input to the ratio. Do not compute from the remaining value.
- Attach `consent_limited` to PostHog metrics regardless of technical coverage status.

"Complete" means no known gap in the consent-eligible capture and query path. It does not mean that all real-world activity was observed. Event capture is best-effort and the business flow continues if analytics capture fails, so an apparently complete PostHog period is never a business-system reconciliation guarantee.

### Calendar days and time zones

The reporting service should accept a validated IANA time zone and derive the 7, 30, or 90 local calendar-day window before it queries either source. It should send explicit UTC instants as a half-open range, `timestamp >= from AND timestamp < to`, and return `timezone`, `from`, `to`, and `asOf`. If validation fails, it should return UTC with an explicit fallback marker such as `timezoneSource: utc_fallback`.

For a daily PostHog series, the bucket time zone must match the requested user time zone. PostHog supports `toTimeZone`, `toStartOfDay`, and `dateTrunc` in HogQL ([PostHog supported date and time functions](https://posthog.com/docs/sql/clickhouse-functions#dates-and-times)). A service may use those functions with a validated time-zone value or aggregate timestamped results server-side. It must not rely on PostHog's project-time-zone buckets when that zone differs from the requested zone.

The current interval includes the local day in progress through `asOf`. The preceding comparison should cover the immediately preceding equal number of local calendar days and end at the same local wall-clock time. A daylight-saving transition can make the two UTC durations differ. That is correct for a calendar-day comparison.

### Period comparisons

Activity counts should return the current value, prior value, absolute delta, and relative delta. The relative delta is `(current - prior) / prior`. When the prior value is zero, return `null` with `zero_baseline`; keep the absolute delta.

Ratios should return current and prior values plus the difference in percentage points. A move from 10% to 12% is `+2 percentage points`, not `+20%` in the main Dashboard copy. The relative change may be mathematically calculable when the prior ratio is non-zero, but it answers a less direct question and should stay out of V1.

Do not compare periods when either side has partial source coverage. Do not turn a pre-instrumentation period into zero. Snapshot metrics such as review average, review count, and profile completeness remain outside these activity comparisons.

A future funnel comparison has one additional rule. Compare only entry cohorts that received the same full conversion window. If the current cohort has not matured, return a provisional status or omit the comparison. PostHog's "hide incomplete periods" behavior is the right model for this contract.

## Gate for a true funnel

A future implementation can call the metric a funnel only after all of these conditions hold:

1. The browser and form bridge use the same stable anonymous `distinct_id`, or the application links their IDs according to a documented identity strategy.
2. For the recommended session funnel, the form submission carries the browser's `$session_id` into the server event.
3. `clinic_profile_viewed` has a defined late-consent behavior. Either capture the eligible view when consent begins or declare that only views after consent are funnel entries.
4. Every step applies the authenticated clinic's server-derived `clinic_id` filter. The browser must never choose the tenant filter.
5. The query specifies actor type, sequential order, first-occurrence rule, conversion window, date bounds, and coverage start. No vendor default remains implicit.
6. Synthetic journeys prove same-session conversion, repeated views, repeated CTA clicks, direct inquiry without CTA, late consent, zero denominator, and a daylight-saving boundary.

Once those gates pass, use this design:

- Primary: unique-session, sequential `clinic_profile_viewed -> patient_inquiry_created`.
- Diagnostic: unique-session, sequential `clinic_profile_viewed -> clinic_cta_clicked -> patient_inquiry_created`, with CTA-step attribution by `cta_id`.
- Do not use strict order. Page interactions and form events may occur between the business steps.
- Do not require a CTA in the primary funnel. Requiring it would remove valid direct inquiry paths and answer a narrower question.
- Keep total event counts beside the funnel. The counts explain activity volume; the funnel explains ordered session completion.

If product stakeholders later need cross-session behavior, add a separate tracked-browser funnel with its own conversion window and label. Do not silently change the session funnel's aggregation unit.

## Decision impact

The reporting-contract ticket can close without pretending that a multi-step funnel exists today. The defensible V1 contract is:

1. independent consent-limited PostHog activity counts,
2. authoritative Payload inquiry counts,
3. an optional event ratio with explicit semantics and limitations,
4. local-calendar period comparisons with coverage-aware nulls,
5. a gated future session funnel after identity continuity and conversion-window research.
