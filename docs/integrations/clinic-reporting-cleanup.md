# Clinic reporting cleanup inventory

This inventory covers Website/Payload and Clinic Dashboard reporting under Dashboard issues #299 and #304.
Source inspection and read-only PostHog inspection took place on 1 November 2026. It records source removal and
remaining release/data dependencies. No deployment, external capture, analytics mutation or historical deletion was
performed. The approved story/specification and historical ADR 029 remain unchanged.

## Source consumers and decisions

| Data or structure | Existing consumer and concrete purpose | Decision at the cleanup source checkpoint |
| --- | --- | --- |
| Five reporting cards and count comparisons | Dashboard reporting mapper, DTO validation and BFF; Website `reporting/posthog-v2.ts` and `reporting/service.ts` supply counts and states | Keep Impressions, Profile Views, Unique Visitors, Inquiry starters and Inquiries. Keep independently sourced current reviews. |
| Separate session conversion display | Dashboard `clinic-dashboard-reporting-display.ts` had the unused display helper and `clinic-dashboard-reporting.ts` its orphan type; visible summary was removed in #300 | Remove helper, type and obsolete tests. No separate session totals, rates, zero-denominator state or percentage-point comparison remains in the active model. |
| V1 wire catalog | Website reporting endpoint selected the V1 service for an absent/explicit V1 content header; Dashboard V2 requests the successor explicitly | Remove V1 DTO, selection branch and old service. Require the explicit V2 header. Release depends on the consumer switch below. |
| V1 aggregate calculations | Website `reporting/posthog.ts` calculated CTA totals/by-ID, profile-view sessions, ordered inquiry sessions and conversion coverage; `service.ts` calculated rates and percentage-point deltas | Remove the V1 adapter and calculations. The single V2 query reads only profile-view, impression and inquiry-start events. There is no stored reporting aggregate, Reporting collection, scheduler or migration to delete. |
| Reporting profile-completeness duplicate | V1 `service.ts` queried clinic profile fields and active treatments solely for a six-area reporting snapshot | Remove the duplicate computation, treatment query and unused profile fields from the reporting clinic read. Keep its address/country read for the existing Türkiye scope check. |
| Published profile progress, tasks and preview | Separate Website profile projection and Dashboard workspace profile-progress assembly serve published profile progress and edit navigation | Keep these independent profile functions and their data. No change to gallery, treatments, profile publication, previews or review sources. |
| CTA raw capture | Clinic detail template emitted CTA callbacks through its route adapter and `postHogBrowserEvents.clinicCtaClicked`; registry/query catalog supplied the old reporting consumer | Remove the callback contract, capture wrappers, browser method and registry/catalog entries. Treatment selection, doctor selection and contact scrolling still perform their ordinary UI actions. Preserve the new form-edit callback. |
| Server inquiry raw capture | Guest contact route and authenticated patient create endpoint called `captureStoredPatientInquiryPostHogEvent` after a new stored inquiry | Remove those analytics calls, `posthog/inquiry.ts`, typed server method and registry entry. Keep durable inquiry commands, guest deduplication, authenticated idempotent replay, audit, notifications, authorization and session authentication. |
| Custom inquiry analytics session transport | Clinic route submitter appended consented `session_id`; guest/authenticated endpoints extracted it and the old server event forwarded `$session_id`; `inquirySessionCorrelation.ts` validated it | Remove the submission getter, custom browser payload field, correlation extraction and validator. During the coordinated rollout, both inquiry-create HTTP boundaries discard only the legacy `session_id` field so already-open tabs can still submit. Domain commands and persistence receive no analytics field; strict schemas still reject unrelated extra fields. No patient/account or form value becomes an analytics identifier. |
| Generic form bridge | Marketing partner submission still emits `clinic_onboarding_interest_created`; generic profile contact forms never create patient inquiries | Keep partner capture, source/referer validation and generic field stripping. Remove obsolete clinic-inquiry session validation. Continue discarding internal identifiers before form persistence, including legacy `session_id`, `$session_id` and `distinct_id`. This is privacy filtering, not analytics correlation. |
| General browser SDK and session diagnostic | Cookie consent adapter renders a hidden `[data-analytics-diagnostics]` snapshot, documented in `posthog.md`, for DevTools inspection of consent/SDK readiness; tests verify its closed boolean schema | Keep internal consent-gated session availability only for this existing diagnostic. It exposes no identifier and has no submission or reporting role. Keep SDK consent, identity reset, replay/error tracking and general analytics infrastructure. |
| Profile-view raw events and browser recognition | Profile Views counts repeated profile events; Unique Visitors deduplicates their existing browser identity | Keep capture, registry, raw history and consent-controlled SDK recognition. SDK-owned session properties do not feed the V2 calculations. |
| New browser capture | The clinic form callback and listing visibility callback supply the new governed inquiry-start and impression events through the existing facade | Keep both registrations and typed facade methods when integrating #302/#303. Neither includes field values, selections, contact content or medical data. |
| Transport observer | `scripts/testing/posthog-observer.ts` recognizes retired CTA names so controlled/browser diagnostics can detect unexpected obsolete transport | Keep negative-evidence decoding. Recognizing a historic event name does not register or capture it. Its session matching still checks profile-event transport diagnostics, not inquiry conversion. |

Website reporting, guest/authenticated inquiry and form-bridge tests exercise their existing public boundaries with
controlled external systems. Installed-SDK browser compositions verify preserved consent/profile behavior, no CTA
acceptance and identifier-free guest/authenticated submission. The query fixture executes the exact emitted SQL against
an isolated synthetic ClickHouse database containing both retained profile views and retired-event noise. It checks
computed values and output columns, not only SQL text. These checks do not prove live delivery or deployed consumer use.

A separate read-only compiler probe captured the production V2 query emitted by the compatible Website checkpoint
`fd497ff923d95257ee3e5e314dbed05f658c0fb3` and executed it unchanged through the connected PostHog HogQL query tool.
A synthetic clinic target `0` and bounded seven-day windows returned a zero aggregate row. The compiler accepted the
query shape and its functions; warnings reported the absent new event taxonomy. This proves compiler compatibility
only. It does not prove clinic values, event ingestion, continuous history, configured deployed credentials or rollout.

## Inspected external consumers

The connected read-only PostHog account exposed only organization `findmydoc-preview`, project `findmydoc`, ID `81797`.
This is the inspected scope, not proof that deployed query credentials address that project. No other organization or
project is covered. All six saved insights and all three dashboards were fully read; listing responses had no next page.

| Consumer kind | Evidence in the inspected project |
| --- | --- |
| Saved insights | Exactly six, IDs 1275481 through 1275486. All use only `$pageview` for active users, retention, lifecycle, referrers or a pageview funnel. |
| Dashboards | Exactly three, IDs 226746, 673489 and 673490. The first contains the six pageview insights. The generated feature-flag dashboards have zero tiles. |
| Actions | Zero. |
| Other nondeleted insight definitions | System query matching `clinic_cta_clicked` or `patient_inquiry_created` in query/filters returned zero, including unsaved insights. |
| Cohorts | System query matching either retiring event in query/filters/groups returned zero. |
| Batch exports | Zero. |
| Hog functions/destinations | Only the enabled built-in GeoIP transformation; no export destination. |
| Data-modeling endpoints, endpoint versions, notebooks, usage metrics and alerts | Zero of each. |

These observations establish no configured analysis consumer of either retiring event within the inspected project.
They do not establish absence of a consumer in an inaccessible project, an external warehouse or an uninspected account.
No hypothetical future consumer justifies continued obsolete capture.

## Raw history and irreversible cleanup dependency

The read-only aggregate query used this exact inspected bound and event set:

```sql
SELECT event, count(), min(timestamp), max(timestamp),
  countIf(notEmpty(toString(properties.$session_id)))
FROM events
WHERE timestamp >= toDateTime('2025-11-01 00:00:00')
  AND timestamp < now()
  AND event IN ('clinic_profile_viewed', 'clinic_cta_clicked', 'patient_inquiry_created')
GROUP BY event
```

It selected aggregate counts/timestamps only, with no individual identities, form values, patient content or URLs.
The one-year read bound does not describe data outside that window or prove physical deletion.

| Event | Observed rows | First activity | Last activity | Rows with session context | Historical decision |
| --- | ---: | --- | --- | ---: | --- |
| `clinic_cta_clicked` | 21 | 2026-05-25T13:23:14.548+02:00 | 2026-10-28T00:33:44.021+01:00 | 20 | Candidate for event-only deletion under #305 after capture stops and exact approval. |
| `patient_inquiry_created` | 28 | 2026-05-24T15:36:53.093+02:00 | 2026-10-28T00:33:26.930+01:00 | 10 | Candidate for event-only deletion under #305 after capture stops and exact approval. |
| `clinic_profile_viewed` | 31 | 2026-05-25T13:23:14.494+02:00 | 2026-10-28T00:33:40.771+01:00 | 30 | Retain for Profile Views and Unique Visitors. |

Removing request-time aggregates, registry definitions or capture code does not delete these raw events. No person,
patient, inquiry, audit, authentication, idempotency, notification or Payload business record is a deletion target.
The new impression/start events were absent from the observed taxonomy; this does not establish historical zero.

The connected tools permit aggregate queries and consumer inspection. They expose no supported targeted event-deletion
request. Person deletion would also remove required profile activity and is unsuitable. #305 therefore requires a
supported targeted deletion mechanism, the intended project, a fixed cutoff and a fresh preview of exact affected counts.
The deletion predicate must be event-only:
`event IN ('clinic_cta_clicked', 'patient_inquiry_created')` plus the explicitly approved fixed time boundary.
Do not target a person/session or include `clinic_profile_viewed`, `$pageview`, operational inquiries or shared SDK data.
After separately approved execution, verify raw removal and preserved sources/functions. This inventory records no
completed historical deletion.

Official capability references inspected through the connection were
[PostHog data deletion](https://posthog.com/docs/privacy/data-storage#data-deletion),
[event retention](https://posthog.com/docs/data/events-retention) and
[the event model](https://posthog.com/docs/data/events). Definition deletion is not raw-event deletion.

The official data-storage guide was checked again on 1 November 2026. Its manual deletion targets persons and their
associated events. The guide also states that retention cannot be shortened to delete data. The
[Events API reference](https://posthog.com/docs/api/events) documents no delete operation. None of these is a supported
event-only cleanup mechanism for this scope.

The companion [Dashboard evidence and completion record](https://github.com/findmydoc-platform/clinic-dashboard/blob/feature/299-clinic-reporting/docs/testing/clinic-reporting-evidence.md)
maps all #305 acceptance criteria to the three agreed test boundaries and records the remaining rollout, source and
deletion prerequisites. The cross-repository link requires publication of the companion integration branch. Before any
separate deletion approval, record a supported mechanism, intended project, immutable event predicate, fixed cutoff,
fresh affected counts and retained consumers. After approved execution, retain the completion reference and compare
the same bounded query before/after, then verify retained profile/new events and independent Payload functions.
No deletion or after-proof exists; #305, parent specification #299 and gap #298 remain open.

## Coordinated release boundary

The immutable V1-compatible Website producer checkpoint is
`fd497ff923d95257ee3e5e314dbed05f658c0fb3`. Dashboard's first V2 consumer checkpoint is
`02596f4019c4a7f9fd3fb31525fa775d188f6f90`. The cleanup source removes V1 compatibility and cannot substitute for
the compatible checkpoint in a joint release.

1. Deliver that V1-compatible Website producer first. Confirm old and V2 consumers can read their respective contract.
2. Deliver Dashboard V2. Obtain operational evidence that deployed reporting requests use the explicit V2 header and
   all needed consumers have switched. Record the actual deployed revisions and source results.
3. Only then deliver the final Website cleanup containing this inventory. Verify authorized V2 values/states and
   rejection of V1, then confirm obsolete capture/transport has stopped before preparing #305's deletion preview.

Source commits and controlled tests prove neither step's deployed completion. No deployed consumer switch or capture
stop was observed during this work. This is an open release dependency, not permission to deploy.

The local registered Website profile was provisioned from its existing environment cache, without contacting Keeper.
A presence-only inspection found a Payload secret but no PostHog query credential, query project, retention or any capture
start setting. This describes that cached profile only. It cannot establish real reporting availability, project identity
or Preview/Production coverage. Verify actual capture starts during release; neither first observed activity nor query
retention proves uninterrupted instrumentation.
