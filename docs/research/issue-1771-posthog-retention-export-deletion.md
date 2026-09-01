# PostHog retention, export, and deletion constraints for clinic reporting

Research for [website issue #1771](https://github.com/findmydoc-platform/website/issues/1771), observed on 2026-08-31. The PostHog project was inspected read-only through the connected PostHog API surface. No PostHog configuration or data was changed.

## Decision summary

- The active findmydoc PostHog Cloud EU project currently exposes a plan-derived product analytics retention window of **12 months**, while retention enforcement is **disabled** for the project. This is not a safe customer promise: PostHog's current implementation can begin flooring event queries to the entitlement window when a cohort-gated rollout enables enforcement.
- The 12-month value is an **availability limit for event queries**, not evidence of a contractual physical-deletion schedule. The inspected PostHog source applies the limit when preparing event scans. Neither the connected project metadata nor the public documentation establishes when older raw events are physically erased.
- The first dashboard scope needs 7-, 30-, and 90-day periods. A previous-period comparison for 90 days requires at least **180 days** of queryable source data. The current 12-month entitlement covers that requirement with operational margin, but the two live clinic events have non-zero data only from May 2026. As of this research, a full 90-day previous-period comparison crosses a pre-instrumentation window and must expose incomplete coverage instead of treating earlier zeros as measured inactivity.
- PostHog should remain the behavioral source for consent-eligible profile views and CTA activity. Payload remains authoritative for inquiries and other business facts. PostHog counts are coverage-limited and must not be presented as total business activity.
- If clinics need stable history beyond the provider entitlement, store **clinic-level, time-bucketed, non-personal aggregates** in an owned reporting store. Do not default to exporting raw person-level events. An owned aggregate layer needs its own correction, retention, deletion, and audit policy in the reporting ADR.
- Saved PostHog insights and ordinary query caches do not provide independent customer-history retention. Materialization improves latency and can store precomputed results, but no reviewed source guarantees that person/event deletion or provider retention automatically propagates to every materialized derivative or external export.
- Bookings, appointments, reservations, and impressions remain outside the model. There is no source-backed booking event or booking domain for this reporting contract.

## Confirmed live-project facts

The connected organization has one active project named `findmydoc`, hosted on PostHog Cloud EU. Sensitive project tokens and account identifiers are intentionally omitted.

| Observed field or inventory | Live value | Reporting consequence |
| --- | --- | --- |
| Product analytics event retention | 12 months | This is the current plan-derived query window, not a repository-controlled guarantee. |
| Retention enforcement | Disabled | Older data may remain queryable today, but the implementation can activate enforcement independently of website code. |
| Session replay retention | 30 days | Replay retention is separate from product analytics retention and cannot back the dashboard's historical metrics. |
| Project-level IP anonymization field | Disabled | The reporting ADR must decide whether project-level IP handling is acceptable; clinic aggregate events themselves must continue excluding contact and medical content. |
| Person-on-events querying | Enabled | Person-level joins remain provider behavior. The reporting contract should avoid depending on them because inquiry identity continuity is not trustworthy. |
| Saved insights | 10, none for clinic reporting | Existing insights are not a retained clinic-reporting layer. |
| Saved or materialized warehouse views | 0 | No existing PostHog aggregate store can carry the dashboard history. |
| Recently observed clinic events | `clinic_profile_viewed`, `clinic_cta_clicked` | These behavioral events exist in the live event taxonomy. |
| Observed clinic-event history | 7 profile views and 7 CTA clicks from 2025-08-06 through 2026-08-31; the first non-zero month for both is May 2026 | Volume is currently very low, and earlier zero buckets do not prove that no activity occurred before instrumentation. Coverage start must be part of the reporting response. |
| Repository-defined inquiry event | `patient_inquiry_created` | The event is defined and consent-gated in the website repository, but it was absent from the connected project's live event catalog during this observation. Payload must remain authoritative. |
| Batch-export inventory | Not exposed by the connected tool surface | Whether a batch export already exists is unverified and must be checked in the PostHog project or account API before adopting an export design. |

The official [Projects API](https://posthog.com/docs/api/projects) is the source for project metadata. PostHog's current generated schema describes `event_retention_months` as plan-derived and says enforced projects cannot query older events ([source at the inspected commit](https://github.com/PostHog/posthog/blob/cc70cbba4e00bb7f8735c886259c3e5b31c9ae54/frontend/src/generated/core/api.schemas.ts)).

## Confirmed product behavior

### Event retention is billing-derived and rollout-gated

PostHog's current source defines product analytics retention as a billing entitlement. It maps the entitlement's month or year value to a project-level month count. A missing or invalid entitlement currently falls back to 84 months for grandfathered projects. Enforcement is separately controlled by a cloud cohort flag or an operational override; when enforcement is off, the query helper returns no retention floor ([retention model](https://github.com/PostHog/posthog/blob/cc70cbba4e00bb7f8735c886259c3e5b31c9ae54/posthog/models/team/event_retention.py), [billing synchronization](https://github.com/PostHog/posthog/blob/cc70cbba4e00bb7f8735c886259c3e5b31c9ae54/posthog/temporal/sync_events_retention/activities.py)).

This establishes three different facts that the ADR must not collapse:

1. `event_retention_months` is the current billing-derived entitlement.
2. `events_retention_enforced` reports whether PostHog currently applies the query floor.
3. Neither field is proof of physical deletion or a contractual data-preservation commitment.

The provider configuration does not block 7/30/90-day reporting. Actual collection coverage does block a trustworthy full comparison for the longest period today. The dashboard contract should return both the maximum queryable window and the observed coverage start, then fail or mark the comparison incomplete when either is shorter than requested.

### Person and event deletion is asynchronous

PostHog documents that deleting a person can also queue deletion of the person's events and recordings. Event deletion is asynchronous and runs during non-peak periods; the deletion-status endpoint distinguishes pending from completed work. Session recordings requested for deletion are irreversibly crypto-shredded. Project or organization deletion removes the data below that container ([controlling data storage](https://posthog.com/docs/privacy/data-storage#data-deletion)).

Consequences for clinic reporting:

- A deletion request can temporarily coexist with queryable events until PostHog reports completion.
- Reusing a deleted `distinct_id` before completion can produce unexpected results and is discouraged by PostHog.
- Any raw-event export or independently persisted person-linked derivative needs its own deletion propagation. Deleting the PostHog copy does not establish that an external destination has deleted its copy.
- Clinic/day aggregates that cannot be tied back to a person reduce deletion coupling, but their legal classification and permitted retention still require an explicit privacy decision.

### Export paths preserve data outside PostHog

PostHog batch exports can schedule delivery to S3-compatible storage, Azure Blob Storage, BigQuery, Databricks, Snowflake, Postgres, or Redshift. The event model is immutable and UUID-addressable; the persons model is mutable and must be merged at the destination. Historical backfills are bounded by the earliest data still available to PostHog. PostHog warns that exports and backfills can produce duplicates, so destinations must deduplicate ([batch exports](https://posthog.com/docs/cdp/batch-exports)).

The Query API is not an export mechanism. PostHog directs large-volume extraction to batch exports or file-download exports, and documents query permissions separately ([API queries](https://posthog.com/docs/api/queries)).

Raw batch export is therefore a poor default for the clinic dashboard:

- it expands the privacy and deletion surface;
- it exports consent-limited event detail that the dashboard does not need;
- it adds deduplication, mutable-person mapping, destination security, and deletion-propagation obligations;
- it still cannot backfill data that PostHog no longer exposes.

Use it only if an independently governed raw analytics archive is a separate accepted requirement.

### Insights, caches, and materializations are different storage classes

PostHog's normal query path runs against the available source data. Caching stores query results temporarily and reruns the query after its freshness window. Materialized endpoints or warehouse views precompute and store results on a schedule for repeated access ([endpoint caching](https://posthog.com/docs/endpoints/caching), [endpoint materialization](https://posthog.com/docs/endpoints/materialization), [materialized warehouse views](https://posthog.com/docs/data-warehouse/views/materialize)).

No reviewed public source guarantees that event-retention enforcement or a completed person deletion immediately removes every cached result, materialized endpoint result, warehouse materialization, or external export. This is a material open compliance question, not a property to infer from the PostHog UI.

For the ADR, treat the storage classes as follows:

| Storage class | Suitable role | Retention conclusion |
| --- | --- | --- |
| Direct PostHog query | Initial 7/30/90 behavioral reporting | Limited by the current plan entitlement and provider enforcement. |
| Ordinary PostHog insight or query cache | Analyst convenience and short-lived performance optimization | Not durable customer history. |
| PostHog endpoint or warehouse materialization | Provider-side latency optimization | Requires explicit deletion-propagation and retention verification before customer use. |
| Raw batch export | Independently governed analytics archive | High privacy and operational cost; not justified by the current dashboard scope. |
| Owned clinic/day aggregate | Stable customer history beyond provider retention | Preferred extension if longer history is accepted; must have a defined lifecycle and correction policy. |

## Repository reporting contract

The website event registry defines `clinic_profile_viewed`, `clinic_cta_clicked`, and `patient_inquiry_created` as consent-eligible events containing clinic identifiers and bounded metadata, not patient contact details or medical free text ([PostHog integration](../integrations/posthog.md), [event registry](../../src/posthog/events.ts)). Server-side inquiry analytics deliberately fail open for the business submission: inquiry creation can succeed while PostHog capture is skipped or fails ([server facade](../../src/posthog/api.ts)).

The dashboard capability matrix already fixes the source boundary:

- PostHog supplies consent-eligible profile-view, CTA, and trend aggregates.
- Payload supplies authoritative inquiry, review, and profile-completeness facts.
- The per-submission fallback identity means a true person-level profile-view-to-inquiry funnel is not currently trustworthy.
- A period-based event ratio may be shown only with clear source and coverage semantics.
- No impression or booking source exists ([clinic dashboard capability matrix](../roadmap/clinic-dashboard/capability-matrix.md)).

This means retention cannot be a single provider-wide number. The ADR needs a retention policy per metric source:

| Metric family | Authoritative source | Retention concern |
| --- | --- | --- |
| Profile views and CTA activity | PostHog | Consent-limited, currently 12-month plan window; optional owned aggregate if longer history is required. |
| Inquiry totals | Payload | Governed by the business record lifecycle, not PostHog retention. |
| Inquiry ratio | Mixed derived metric | Numerator and denominator have different coverage; store inputs and coverage metadata if snapshots are persisted. |
| Reviews and completeness | Payload | Use current source-backed state or an explicitly defined historical snapshot; do not infer history from current rows. |
| Bookings, reservations, impressions | No source | Out of scope; no metric or retention promise. |

## ADR inputs and recommendation

### Minimum decisions

The reporting ADR should record:

1. **Customer-visible horizon:** 7/30/90 only, trailing 12 months, or year-over-year. Include the comparison window in the retention calculation.
2. **Source availability SLO:** the minimum provider history and continuous collection coverage that the product contract requires, plus behavior when either is shorter than requested.
3. **Persistence policy:** direct queries only for the first release, or clinic/day aggregate snapshots for longer history.
4. **Aggregate schema:** metric key, clinic ID, UTC/local bucket, value, source, coverage class, source window, calculated-at time, correction version, and completeness status. Do not store person identifiers or raw event payloads.
5. **Correction and backfill:** whether late events, consent changes, inquiry corrections, or source outages rewrite historical buckets and for how long.
6. **Deletion and expiry:** retention for PostHog data, owned aggregates, caches, logs, exports, and backups; owner and evidence for deletion completion.
7. **Privacy posture:** project-level IP handling, permitted event properties, query credentials, tenant isolation, and whether anonymized clinic aggregates remain non-personal in the accepted legal assessment.
8. **Performance boundary:** whether PostHog is queried synchronously, through a short-lived private cache, through materialization, or behind an owned aggregate store.
9. **Coverage language:** behavioral metrics must state that analytics consent limits coverage; Payload business totals must remain visually distinct.
10. **Provider-change handling:** alerting or startup checks for a changed retention entitlement or enforcement state before customer history silently truncates.

### Recommended first-release boundary

- Offer the existing 7/30/90 periods, but show a previous-period comparison only when its complete source window is available.
- Require at least 180 days of provider-queryable behavioral data; treat the observed 12-month entitlement as margin, not as the product contract itself.
- Return a source coverage start and completeness state for every PostHog-derived series. Do not interpret pre-instrumentation zero buckets as measured zero activity.
- Query PostHog server-side for bounded, tenant-scoped aggregates and combine them with authoritative Payload values. Use private, short-lived caching only after a separate freshness decision.
- Do not introduce a raw batch export or person-level reporting store.
- Design the reporting DTO so an owned clinic/day aggregate source can replace direct PostHog queries without changing dashboard semantics.
- If product discovery requires history beyond 12 months or year-over-year comparisons, add the owned aggregate store before making that promise.

## Open contractual and operational questions

- Which invoice, plan, or negotiated contract currently grants the observed 12-month entitlement, and can it change automatically with billing state?
- When will PostHog enable `events-data-retention` enforcement for this project or its cohort?
- Does the 12-month entitlement describe query visibility only, or does a separate contract specify physical deletion and backup expiry?
- Are batch exports configured outside the connected tool inventory, and if so, where do they write, how long is data retained, and how are deletions propagated?
- What guarantees does PostHog provide for invalidating ordinary insight caches, materialized endpoints, and materialized warehouse views after deletion or retention expiry?
- Is project-level IP handling acceptable for the consent and privacy policy, or must IP anonymization/discard be enabled before customer reporting expands?
- Do clinics need only 90-day operational reporting, a trailing 12-month history, or year-over-year evidence? This product decision determines whether provider-only retention is sufficient.
- What legal retention period applies to consent-derived marketing analytics and to clinic-level derived aggregates? This requires the accepted privacy/legal assessment, not a technical inference.

## Evidence boundaries

- **Confirmed live facts** are values returned by the connected PostHog organization, project, schema, insight, and warehouse-view reads on 2026-08-31.
- **Confirmed product facts** come from current PostHog documentation or the inspected upstream source commit linked above.
- **Inferences** are explicitly framed as architectural consequences or recommendations.
- **Contract questions** remain open where runtime metadata and public documentation do not establish a durable commercial or legal guarantee.
