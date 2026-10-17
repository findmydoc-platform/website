# Clinic Dashboard Application and API Architecture

> **Canonical decision:**
> [ADR 026](https://github.com/findmydoc-platform/platform-architecture/blob/main/decisions/026-adr-standalone-clinic-dashboard-bff-architecture.md) (GitHub access required)
>
> **Paired Dashboard architecture:**
> [Clinic Dashboard authentication and BFF architecture](https://github.com/findmydoc-platform/clinic-dashboard/blob/main/docs/authentication-and-bff.md)
>
> **Repository responsibility:** This repository owns Payload authentication, authorization, business endpoints, and
> DTO contracts. The Clinic Dashboard repository owns its BFF, session cookies, Route Handlers, React Server Component
> data layer, and user-facing error states.
>
> **Synchronization rule:** Shared routes, DTOs, error semantics, environment assumptions, and security controls must
> be updated in both architecture documents within the same implementation change. Neither repository may infer a new
> cross-repository contract from runtime code alone.

## Runtime Status and Scope

This document records the approved server-to-server integration contract for the standalone Clinic Dashboard. It is
durable architecture documentation, not an execution plan. The contract does not add browser access to Payload,
Payload CORS origins, a Dashboard database, service-role credentials, public cache behavior, or clinic login UI to the
website.

Payload exposes the private bootstrap contract, the persistent clinic-profile draft workflow, the focused clinic
treatment and gallery contracts, and the inquiry communication contract. The Clinic Dashboard session and BFF runtime
are implemented in the Dashboard repository; trusted preview and production rollout evidence remain pending.

The notification foundation adds Website-owned immutable occurrences, personal receipt storage and the read-only
new-inquiry path. Guest and verified submissions capture one occurrence inside their existing source transaction,
subject to a persisted activation boundary that defaults to inactive. Installed `clinic-notifications-v1` support
is negotiated separately from capture activation. Its [closed wire contract](../architecture/clinic-notifications-v1.md)
defines the complete catalog for the following implementation slices. Personal explicit marking now persists first
read receipts through the authorized acknowledgement command. Remaining producers, exact destination opening,
continuation loading and independent cleanup remain separate slices.
Hosted capture stays inactive; local isolated acceptance does not establish Preview or Production availability.

The personal notification feed reads the current union of eligible clinics for the principal's local or group
assignment. Each occurrence or patient-message presentation includes one strict `clinic: { id, name }` attribution
with its current clinic name. Notifications and explicit receipt selections remain personal at
`/api/clinic-dashboard/notifications` and `/read`; they never use an active-clinic URL. Signed continuations bind
principal, view and contract version while each request rereads current eligibility. Both routes require the existing
notification contract header plus `X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1`, with both headers in `Vary`.
An eligible person with no clinics receives an empty feed and zero count; receipt commands reject complete clinic
access loss. The closed notification contract defines full grouping, limits, visibility and atomic receipt semantics.

The [notification contract](../architecture/clinic-notifications-v1.md) defines acknowledgement eligibility at the final
atomic server decision immediately before the native commit call. A decision before expiry may finish committing
afterward; logical feed/count/group expiry remains exact at ninety days. This user-approved boundary does not claim
a physical commit-time guarantee or hosted activation.

## Boundary and Ownership

| Concern | Website and Payload | Clinic Dashboard |
| --- | --- | --- |
| Identity validation | Validate the Supabase access token against the matching environment. | Complete server-side password login or explicitly confirmed TokenHash invite/recovery, then store and refresh the user session in host-bound `HttpOnly` cookies. |
| Current principal | Resolve `clinicStaff`, status, clinic assignment, and access on every request. | Treat the returned principal and capabilities as authoritative for the current request only. |
| Business authorization | Enforce collection and endpoint permissions; derive clinic and actor from the principal. | Never send an authoritative clinic, role, or actor value. |
| Browser API | Not exposed to the Dashboard browser. | Expose capability-specific, same-origin Route Handlers. |
| Server rendering | Provide typed Payload REST and custom endpoint contracts. | Read through a server-only Payload client directly from React Server Components. |
| Persistence | Remain the sole business-data persistence boundary. | Own no database or durable business cache. |

## Personal group invitation and activation

An authorized Website back-office operator opens an existing Clinic Group and uses **Invite a personal group
manager**. The control sends `POST /api/clinicGroups/:id/personal-invitation` with only `email`, `firstName`, and
`lastName`. The persisted admin/support role authorizes the operation. This native Admin command is not a Dashboard
browser API and does not confer Payload Admin access.

Website reserves one pending personal principal and immutable operator/group origin before any provider effect.
Repeated preparation reconciles that same onboarding identity; an unknown provider result remains unconfirmed and
retryable. Existing local staff, reassignment, reactivation, revocation, and offboarding use their separate workflows.
An approved synchronized group assignment grants no Dashboard access before trusted personal activation.

Delivery uses the existing Website-owned `clinic-invitation` Auth action, signed cross-app protocol, replay handling,
password-completion claim, and environment activation registry. Preparation does not activate delivery. An inactive
environment returns an explicit inactive-delivery result to the operator; no direct provider invitation bypass exists.
The existing Dashboard confirmation/password journey clears its completion grant and returns to login. A subsequent
login obtains a fresh `clinic-scope-v1` bootstrap. Current eligible group clinics open through that response; an empty
set stays on the restricted workspace. Neither the invitation nor a bootstrap snapshot supplies a later grant.

The client-handled login, reset-request, and password-completion forms declare native POST submission so inputs do
not enter navigation URLs before hydration. Hydrated requests retain the established JSON, origin, CSRF, session,
and signed Auth protocol behavior.

Website records `group-initial-password` evidence only after the completed identity-bound action and a fresh
server-verified password event. The immutable proof binds principal, subject, original group, and Auth action; it
contains no clinic-origin claim. The same protected update establishes `identity-v1` readiness. Current approval,
identity synchronization, original invitation binding, and assignment are checked again before persistence. Existing
clinic-origin completion evidence and its guards retain their established semantics.

## Payload Bootstrap Contract

The initial focused endpoint is `GET /api/clinic-dashboard/bootstrap`. Payload registers it through its standard custom
endpoint conventions; its stable semantic contract is fixed here.

Bootstrap requires exactly `X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1`. Missing, empty, unknown,
mixed, or coalesced duplicate values return `400 CLINIC_DASHBOARD_INVALID_CONTRACT`. This Greenfield contract has
no historical single-clinic response projection. The BFF owns negotiation; the browser does not call Payload.

`X-Findmydoc-Clinic-Dashboard-Contract` remains a separate inquiry-domain contract with its existing
`inquiry-communication-v1` and `inquiry-communication-v2` values. It does not select the bootstrap shape or grant
group access to unconverted domain routes. Notification support negotiation also retains its existing meaning.

Every bootstrap request independently validates the personal Bearer token and binds its subject to the resolved
`clinicStaff` principal. Payload reads current personal activation, approval, assignment, group existence and clinic
participation. Local assignments grant their current clinic; group assignments derive the current group clinic set.
An approved person with no eligible clinic receives a successful bootstrap with an empty `clinics` array. Ineligible
persons receive `403` without clinic data. Invalid identity returns `401`; unavailable identity or source reads return
sanitized `503` responses.

Active-workspace recovery consumes these existing source contracts. A clinic assignment replacement, revocation or group
membership change takes effect on the next scoped operation; stale identity or bootstrap claims cannot authorize it. The
Dashboard then reads a new personal bootstrap and offers only current eligible choices. `403` preserves the valid personal
session, including an approved empty set. Source outages remain distinct from confirmed denial. Recovery introduces no
new source endpoint, stored draft transport, revocation channel, age policy or public-cache invalidation.


```ts
type ClinicDashboardCapability =
  | 'clinic-profile:view'
  | 'clinic-profile:edit'
  | 'clinic-treatments:view'
  | 'clinic-treatments:edit'
  | 'clinic-gallery:view'
  | 'clinic-gallery:edit'
  | 'clinic-inquiries:view'
  | 'clinic-inquiries:edit'

type ClinicScopeBootstrapDTO = {
  schemaVersion: 'clinic-scope-v1'
  principal: { id: string; displayName: string; email: string }
  status: 'approved'
  clinics: Array<{ id: string; name: string; capabilities: ClinicDashboardCapability[] }>
}
```

Clinics are sorted by display name, then stable ID, using the English collation. Each entry projects the eight
closed capabilities in the order above. These capabilities describe existing profile, treatment, gallery and inquiry
operations; they do not introduce doctor, review, notification, reporting or export capability strings. Each domain
still enforces its own source and operation authorization. Unconverted unscoped domain authorization remains local
and fails closed for group managers.

`status: approved` describes personal Dashboard eligibility, not public clinic publication. The DTO omits Supabase
identifiers, tokens, internal roles, account evidence, Payload timestamps and unrelated fields. Private activation
contracts remain documented in [clinic participation](../security/clinic-participation.md).

Success and error responses use `Cache-Control: private, no-store`, `Pragma: no-cache`, `Expires: 0`, and
`Vary: Authorization, X-Findmydoc-Clinic-Dashboard-Contract, X-Findmydoc-Clinic-Scope-Contract`. Bootstrap grants are
request-bound projections. A selected clinic path never grants permission and later requests read current access again.

## Clinic Dashboard Reporting Contract

> **Canonical decision:**
> [ADR 029](https://github.com/findmydoc-platform/website/blob/main/docs/adrs/029-adr-tenant-safe-clinic-dashboard-reporting.md)

`GET /api/clinic-dashboard/clinics/:clinicId/reporting` carries the explicit clinic target and retains the
`clinic-dashboard-reporting-v1` content schema. It requires `X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1`.
The previous unscoped reporting route is removed. Each request validates the personal Bearer identity and authorizes
the positive integer path target against current local or group assignment and clinic participation. The source
clinic record must match that authorized target. Every Payload and PostHog metric read uses that clinic alone.
The request cannot choose role, source, timezone, cache policy or analytic identity. Existing Türkiye availability,
partial-source behavior and export availability remain unchanged; no group aggregation or new export is added.

The sole query parameter is exactly one `periodDays` value: `7`, `30`, or `90`. Missing, repeated, malformed, or
additional parameters return:

```json
{
  "error": {
    "code": "CLINIC_DASHBOARD_REPORTING_INVALID_INPUT",
    "message": "Reporting period must be 7, 30, or 90 days."
  }
}
```

Every success and error response has `Cache-Control: private, no-store`, `Pragma: no-cache`, `Expires: 0`, and
`Vary: Authorization, X-Findmydoc-Clinic-Scope-Contract`. The route has no tags, revalidation, cache layer, cache policy, or public-cache impact
(`no-public-impact`). Authentication failures return `401 CLINIC_DASHBOARD_UNAUTHORIZED` with `Authentication is
required.`; unavailable reporting access returns `403 CLINIC_DASHBOARD_ACCESS_DENIED` with `Reporting access is not
available.`; an authorization/source bootstrap failure returns `503
CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE` with `Reporting is temporarily unavailable.`.

The response is always complete and uses `Europe/Istanbul` calendar boundaries. `asOf` equals `period.to`; all
instants are UTC ISO-8601 values with exactly three fractional digits. A comparison period is the immediately
preceding local calendar block with the same number of days and the equivalent local clock boundary.

```ts
type ClinicDashboardReportingV1 = {
  schemaVersion: 'clinic-dashboard-reporting-v1'
  asOf: string
  timezone: 'Europe/Istanbul'
  period: { days: 7 | 30 | 90; from: string; to: string }
  comparisonPeriod: { days: 7 | 30 | 90; from: string; to: string }
  metrics: {
    profileViews: CountMetric<'posthog'>
    ctaInteractions: {
      source: 'posthog'
      total: CountMetric<'posthog'>
      byCtaId: {
        choose_treatment: CountMetric<'posthog'>
        contact: CountMetric<'posthog'>
        contact_doctor: CountMetric<'posthog'>
      }
    }
    inquiries: CountMetric<'payload'>
    sessionConversion: SessionConversionMetric
    reviews: {
      source: 'payload'
      count: ReviewCountSnapshot
      average: ReviewAverageSnapshot
    }
    profileCompleteness: {
      source: 'payload'
      completedAreas: number | null
      totalAreas: 6
      percent: number | null
      state: 'available' | 'source_unavailable' | 'partial_coverage'
      comparison: null
    }
  }
}

type CountMetric<Source extends 'payload' | 'posthog'> = {
  source: Source
  current: { value: number | null; state: SourceState }
  comparison: {
    value: number | null
    state: SourceState
    absoluteDelta: number | null
    relativeDeltaPercent: number | null
  }
}

type SessionConversionMetric = {
  source: 'posthog'
  current: SessionConversionWindow
  comparison: SessionConversionWindow & { percentagePointDelta: number | null }
}

type SessionConversionWindow = {
  ratePercent: number | null
  numeratorSessions: number | null
  denominatorSessions: number | null
  state: SourceState | 'zero_denominator'
}

type ReviewCountSnapshot = {
  source: 'payload'
  value: number | null
  state: SourceState
  comparison: null
}

type ReviewAverageSnapshot = {
  source: 'payload'
  value: number | null
  state: SourceState | 'no_reviews'
  comparison: null
}

type SourceState = 'available' | 'source_unavailable' | 'partial_coverage'
```

`null` denotes an unavailable or inapplicable numeric value; it is never silently replaced with `0`. Deltas are only
present when both values are available, and relative deltas are `null` when the comparison value is zero. A review
average is `null` with `no_reviews` when the available review count is zero. Session conversion remains unknown when
the correlated funnel cannot be established; a `zero_denominator` is only a known zero-profile-session condition.

Payload owns inquiry counts, review snapshots, and all six profile-completeness areas. PostHog owns profile views,
CTA interactions, and the ordered session funnel. The server executes one aggregate PostHog query per load with a
three-second timeout and no retry. Individual source failure or incomplete coverage remains metric-level state in a
`200` response after authorization, so a source failure cannot erase available metrics from the other source.

The only browser-to-server funnel correlation input is an optional bounded `session_id` on a clinic inquiry request,
and only after analytics consent. It is validated and discarded by bridges and inquiry routes; it is not persisted,
logged, or returned. A server event is emitted only after a new inquiry is durably stored, and its `clinic_id` comes
from that stored inquiry. Browser analytics values are measurement data, never clinic authorization.

## Clinic Profile Draft Contract

The profile capability uses five custom Payload endpoints:

| Method and route | Result |
| --- | --- |
| `GET /api/clinic-dashboard/clinics/:clinicId/profile` | Returns the current published profile, the optional active draft, and safe Türkiye city options. |
| `POST /api/clinic-dashboard/clinics/:clinicId/profile/draft` | Creates the authorized target clinic's active draft from the current published profile after a published-revision check. |
| `PUT /api/clinic-dashboard/clinics/:clinicId/profile/draft` | Replaces the authorized target clinic's active draft after published- and draft-revision checks. |
| `POST /api/clinic-dashboard/clinics/:clinicId/profile/draft/discard` | Deletes the authorized target clinic's active draft after a draft-revision check. |
| `POST /api/clinic-dashboard/clinics/:clinicId/profile/publish` | Atomically applies the draft-owned fields to the public clinic, deletes the draft, and triggers the established clinic revalidation plan. |

Every request requires `X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1` and an explicit clinic path target.
Website repeats current principal, local or group assignment, clinic participation and operation authorization.
The path selects a target; it does not grant access. The stored draft clinic is immutable and must match the target.
Payload stores at most one active `clinicProfileDrafts` record per clinic.

The profile command's existing native transaction owns the clinic/staff authorization barrier, revision checks,
business writes and final current authorization through commit. Direct native draft writers use the same source
barrier and stored ownership checks. Draft operations do not invalidate public output. Successful publication keeps
the existing Website-owned post-commit clinic revalidation plan. Profile writes do not retry automatically.

Draft creation accepts only `{ expectedPublishedRevision }`. The server copies the current published name,
description, public postal address, supported languages, and opening hours into revision `1`; callers cannot supply
initial field values or a clinic ID in the request body. Draft updates require the complete draft-owned field set plus
`expectedPublishedRevision` and `expectedDraftRevision`.

The response contract is:

```ts
type ClinicProfileSnapshotDTO = {
  availableCities: Array<{ id: string; name: string }>
  draft?: ClinicProfileSourceFieldsDTO & {
    basePublishedRevision: number
    revision: number
  }
  published: ClinicProfileSourceFieldsDTO & {
    revision: number
  }
}

type ClinicProfileSourceFieldsDTO = {
  address: {
    city?: { id: string; name: string }
    country: { code: "TR"; name: "Türkiye" }
    houseNumber: string
    street: string
    zipCode: string
  }
  descriptionText: string
  name: string
  openingHours?: Record<
    "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
    { closesAt: string; isClosed: boolean; opensAt: string }
  >
  supportedLanguages: Array<
    | "german"
    | "english"
    | "french"
    | "spanish"
    | "italian"
    | "turkish"
    | "russian"
    | "arabic"
    | "chinese"
    | "japanese"
    | "korean"
    | "portuguese"
  >
}
```

Draft updates carry `expectedDraftRevision: number` and `expectedPublishedRevision: number`. Discard carries
`expectedDraftRevision`; publish carries both expected revisions. A changed published profile, changed active draft,
or stale draft base returns `409 CLINIC_PROFILE_CONFLICT`. A missing draft returns
`404 CLINIC_PROFILE_DRAFT_NOT_FOUND`. Structurally invalid input returns `400 CLINIC_PROFILE_INVALID_INPUT`; a
structurally valid but business-incomplete draft remains saveable and returns the same code with `422` only when
publication is attempted.

The draft owns only clinic name, description, public address, supported languages, and opening hours. Coordinates,
gallery entries, doctors, treatments, contact fields, trust state, and every other clinic field remain outside the
draft and publish mutation. An unchanged description keeps its stored rich-text document exactly; deliberately changed
plain text is stored as canonical rich-text paragraphs.

Draft read, create, update, and discard do not mutate `clinics` and do not trigger public revalidation. Publish checks
and writes the clinic plus draft deletion in one database transaction. It then dispatches the existing clinic-surface
revalidation event after commit.

## Clinic Treatment Contract

The treatment capability uses one focused custom Payload endpoint rather than generic collection REST:

| Method and route | Result |
| --- | --- |
| `GET /api/clinic-dashboard/treatments` | Returns the assigned clinic's complete treatment snapshot and the central treatment catalogue. |
| `POST /api/clinic-dashboard/treatments` | Creates one inactive offering for an existing central treatment. |
| `PATCH /api/clinic-dashboard/treatments` | Updates only EUR price and active state after an optimistic revision check. |

Every request repeats bootstrap authorization, requires `clinic-treatments:view` for reads or
`clinic-treatments:edit` for writes, and derives the clinic from the approved `clinicStaff` assignment. No request
accepts a clinic ID. The endpoint returns purpose-specific DTOs and does not expose generic Payload query, depth,
relationship, or collection response semantics.

```ts
type ClinicTreatmentMasterDTO = {
  descriptionText: string
  id: string
  name: string
}

type ClinicTreatmentOfferingDTO = {
  active: boolean
  id: string
  priceEUR: number
  revision: string
  treatment: ClinicTreatmentMasterDTO
}

type ClinicTreatmentSnapshotDTO = {
  catalogue: ClinicTreatmentMasterDTO[]
  offerings: ClinicTreatmentOfferingDTO[]
}
```

Create accepts only `{ treatmentId, priceEUR }`; Payload assigns the authenticated clinic and stores `active: false`.
The offering can be activated only by a later update. Update accepts
`{ offeringId, expectedRevision, priceEUR, active }`. `revision` is the offering's ISO `updatedAt` value. Payload finds
the offering by both ID and assigned clinic and compares the expected revision inside a serializable transaction.
Serialization failures are retried; a retry observes the newer revision and returns a conflict instead of overwriting
it. Treatment name and plain-text description remain projections of the central Treatment record and are never
writable through this endpoint.

Invalid request structure returns `400 CLINIC_TREATMENT_INVALID_INPUT`; a missing or unavailable master treatment
returns `422 CLINIC_TREATMENT_INVALID_INPUT`; a foreign or missing clinic offering returns
`404 CLINIC_TREATMENT_NOT_FOUND`; a duplicate clinic/treatment pair or stale revision returns
`409 CLINIC_TREATMENT_CONFLICT`. Authentication and temporary-service errors reuse the stable Clinic Dashboard error
codes. Every response is private-live with `Cache-Control: private, no-store`, `Pragma: no-cache`, `Expires: 0`, and
`Vary: Authorization`.

Clinic-treatment writes retain the existing `clinictreatments` hook behavior. Transactional updates suppress the hook's
in-transaction invalidation and dispatch the same related-clinic plan once after commit, preventing an invalidated
public cache from refilling against pre-commit data. Public clinic detail and listing comparison reads remain
`public-cached`; the existing event, cache-policy entries, tags, planner owner, and bounded public paths remain
authoritative. The private Dashboard endpoint adds no cache class, tag, surface, or invalidation owner.

## Clinic Gallery Contract

The gallery capability uses four focused custom Payload operations:

| Method and route | Result |
| --- | --- |
| `GET /api/clinic-dashboard/gallery` | Returns the saved ordered gallery, its revision, and upload constraints. |
| `POST /api/clinic-dashboard/gallery/media` | Accepts exactly one multipart image and returns one private draft medium. |
| `PUT /api/clinic-dashboard/gallery` | Atomically publishes the supplied order and metadata after a revision check. |
| `POST /api/clinic-dashboard/gallery/discard` | Accepts private draft IDs for post-response permanent cleanup. |

Every request repeats bootstrap authorization, derives the clinic from the approved `clinicStaff` assignment, and
requires `clinic-gallery:view` for reads or `clinic-gallery:edit` for mutations. No request accepts a clinic ID,
storage key, bucket name, or direct object-storage credential. Clinic Staff cannot bypass this revision-protected
contract through the regular `clinicMedia` collection routes; direct collection writes are Platform-only.

```ts
type ClinicGalleryMediaDTO = {
  alt: string
  captionText?: string
  height?: number
  id: string
  status: 'draft' | 'published'
  thumbnailUrl?: string
  url: string
  width?: number
}

type ClinicGallerySnapshotDTO = {
  constraints: {
    acceptedMimeTypes: readonly string[]
    maxConcurrentUploads: 3
    maxFileBytes: number
    maxItems: 12
    maxPixels: 50_000_000
  }
  items: ClinicGalleryMediaDTO[]
  revision: number
}
```

Uploads accept JPEG, PNG, WebP, or AVIF and remain `draft` until included in a successful save. The application limit
is 4 MiB per request and the Dashboard sends no more than three independent upload requests concurrently. Payload
normalizes orientation and strips metadata before generating its registered image sizes. Returned media URLs are
absolute URLs suitable for server-side Dashboard validation and rendering.

Save accepts `{ expectedRevision, items: [{ mediaId, alt, captionText? }] }`; array order is public order and the first
item is the main image. A serializable transaction verifies the revision, ownership, uniqueness, maximum count, and
required alt text, publishes selected media, returns removed media to `draft`, and updates the gallery, derived
thumbnail, and profile revision together. A stale revision returns `409 CLINIC_GALLERY_CONFLICT` without partial
writes.

Discard accepts `{ mediaIds }` for at most twelve own-clinic, unreferenced drafts. Save, discard, and gallery reads may
schedule one bounded post-response cleanup batch. Cleanup rechecks ownership, `draft` status, and gallery or thumbnail
references before each attempt, then permanently deletes through Payload so the storage adapter removes the original
and every registered size. Cleanup failure is logged and reported without changing the successful user response; a
later gallery read may retry an abandoned draft. The contract makes no time guarantee and defines no scheduler.
Gallery reads consider only unreferenced drafts older than 24 hours as abandoned, so a reload cannot delete a fresh
upload from an active editing session.

Stable gallery errors are `CLINIC_GALLERY_CONFLICT`, `CLINIC_GALLERY_INVALID_INPUT`,
`CLINIC_GALLERY_MEDIA_NOT_FOUND`, `CLINIC_GALLERY_UPLOAD_TOO_LARGE`,
`CLINIC_GALLERY_UNSUPPORTED_MEDIA_TYPE`, and `CLINIC_GALLERY_UNAVAILABLE`. Every response is private-live with the
standard Clinic Dashboard no-store headers. Public cache invalidation remains owned by the Website save path after
commit; metadata or order changes invalidate clinic detail, while a changed main image also invalidates listing and
sitemap surfaces.

## Inquiry communication contract

Every inquiry route selects its clinic through `:clinicId` and requires
`X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1` alongside the inquiry contract header.
Website resolves the current personal principal against that clinic and checks each stored inquiry,
message, note, draft, attachment, and moderation-case relationship. The target never supplies a grant.
Clinic command retries retain the original target. A native Payload transaction holds the shared
clinic/staff authorization barrier through the final stored-access check and business commit.
Direct native clinic writes use the same barrier independently of notification activation.
Existing contact reauthentication, lifecycle, retention, attachment quotas, and actor permissions remain in force.
Inquiry data is private and request-bound; this conversion has no public-cache impact.

The inquiry capability uses focused custom Payload endpoints. Generic REST and GraphQL access to the inquiry
aggregate, conversations, messages, internal notes, attachments, read positions, audit events, moderation cases, and
moderation events stays disabled.
Every route in this section requires exactly one negotiated inquiry contract value before it performs authorization or
domain work. Version 1 excludes the version 2-only `moderation-restricted`, `moderation-restored`, and
`legacy-closed-migrated` system events. Current Dashboard clients use version 2.

| Method and route | Result |
| --- | --- |
| `GET /api/clinic-dashboard/clinics/:clinicId/inquiries` | Returns one cursor-paginated, filtered queue for the current clinic and an opaque change cursor. |
| `GET /api/clinic-dashboard/clinics/:clinicId/inquiries/detail` | Returns one current-clinic detail projection and an opaque change cursor. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/messages` | Stores one idempotent external clinic message and any automatic `contacted` transition atomically. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/notes` | Stores one idempotent, immutable clinic-only note. |
| `PATCH /api/clinic-dashboard/clinics/:clinicId/inquiries/state` | Applies one revision-checked handling or lifecycle command. |
| `PUT /api/clinic-dashboard/clinics/:clinicId/inquiries/read-position` | Changes only the current staff member's personal read position. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/contact/reveal` | Reauthorizes and reveals raw contact values for a current-clinic spam inquiry. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/attachments/drafts` | Creates one actor- and inquiry-bound private upload draft. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/attachments/drafts/finalize` | Verifies and seals one own unused draft. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/attachments/drafts/discard` | Marks one own unused draft discarded and schedules non-blocking object cleanup. |
| `GET /api/clinic-dashboard/clinics/:clinicId/inquiries/attachments/preview` | Reauthorizes and proxies allowlisted attachment bytes for preview. |
| `GET /api/clinic-dashboard/clinics/:clinicId/inquiries/attachments/download` | Reauthorizes and proxies allowlisted attachment bytes for download. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/report` | Reports one opposite-party message, attachment, or conversation without changing visibility. |
| `POST /api/clinic-dashboard/clinics/:clinicId/inquiries/appeal` | Submits the affected clinic's single text-only appeal against an active measure. |

Every operation requires an explicit Supabase Bearer token. Payload verifies that token even when request middleware
already populated `req.user`, then requires the verified Supabase subject to equal the current `clinicStaff` identity.
A cookie-resolved principal, an invalid token, or a token for a different staff identity cannot authorize these
endpoints. Reads require `clinic-inquiries:view`; messages, notes, state changes, and attachment draft mutations require
`clinic-inquiries:edit`. Reports and appeals require `clinic-inquiries:view` and a current participant binding. The
endpoint and domain service both resolve the current clinic and actor. Request bodies and queries reject actor,
clinic, patient, Payload collection, depth, and generic filter inputs.

Contact reveal adds user-presence verification. The same Bearer token must contain a verified object-form first-factor
AMR entry no older than five minutes, and its subject must still match the current staff identity. A silent refresh and
its new `iat` value do not satisfy this check. Missing, string-only, or stale AMR returns
`INQUIRY_REAUTHENTICATION_REQUIRED`; an invalid or different-subject token returns `INQUIRY_UNAUTHORIZED`.

Queue queries accept only lifecycle, unread, handling-status, search, limit, pagination cursor, and
`knownChangeCursor` values. Search covers the inquiry ID, patient name, original request, external messages, internal
notes, and attachment file names. It does not cover contact values, file contents, or OCR output. A foreign, missing,
or no-longer-visible inquiry or attachment returns the same `INQUIRY_NOT_FOUND` response.

Queue and detail reads return an opaque `changeCursor`. Repeating the exact same query or detail read with that value
as `knownChangeCursor` may return `unchanged: true`; callers then keep their existing projection. The queue marker is
bound to the complete response-shaping query, page, projected metadata, activity, and personal read state. The detail
marker covers the complete safe detail projection, including timeline changes that do not increment the inquiry
revision. `knownRevision` remains a compatibility input for detail reads but never determines `unchanged`.

External messages and internal notes are immutable plain text up to 3,000 characters. Message and note inputs carry
actor-bound idempotency keys. State commands carry an expected revision; conflicts return `INQUIRY_CONFLICT` with a
safe current detail projection when available. Read-position responses contain only the updated unread projection.
Contact reveal is read-only and does not change the stored contact state.

Attachment draft upload instructions are short-lived and limited to PNG, JPEG, WebP, or PDF up to 5 MiB. Preview and
download never return a public or signed storage URL. Payload fetches the internally signed object only from the exact
configured storage origin and bucket path, bounds the response to 5 MiB, allowlists the MIME type, and returns the
bytes with safe disposition, `nosniff`, sandbox, and private no-store headers. The Dashboard BFF proxies those bytes
through its same-origin route. Successful authorized attachment activity schedules a bounded best-effort sweep of up
to 50 unbound `draft`, `verified`, or `discarded` records created at least 24 hours earlier. Bound attachments are
always excluded; storage deletion failures remain retryable and never change the endpoint response.

Before creating a storage reservation or issuing a presigned upload, one serializable command transaction enforces at
most 10 active `draft` or `verified` attachments per actor and 100 per clinic. The same transaction limits new
reservations to 20 per actor and 200 per clinic in 15 minutes. Serialization conflicts receive up to three transaction
attempts; an exhausted capacity race returns `INQUIRY_RATE_LIMITED` without issuing an upload URL.

All JSON success and error responses use `Cache-Control: private, no-store`, `Pragma: no-cache`, `Expires: 0`, and
`Vary: Authorization, X-Findmydoc-Clinic-Dashboard-Contract`. The stable inquiry error codes are
`INQUIRY_INVALID_INPUT`, `INQUIRY_UNAUTHORIZED`,
`INQUIRY_ACCESS_DENIED`, `INQUIRY_NOT_FOUND`, `INQUIRY_CONFLICT`, `INQUIRY_INVALID_STATE`,
`INQUIRY_PAYLOAD_TOO_LARGE`, `INQUIRY_UNSUPPORTED_MEDIA_TYPE`, `INQUIRY_RATE_LIMITED`,
`INQUIRY_SERVICE_UNAVAILABLE`, `INQUIRY_SERVICE_TIMEOUT`, and `INQUIRY_REAUTHENTICATION_REQUIRED`. Raw Payload,
Supabase, database, and storage errors never cross this boundary.

The Dashboard BFF remains responsible for its same-origin session-bound CSRF guard on mutations. These server-to-server
Payload endpoints do not add browser CORS access or a second CSRF scheme.

### Inquiry moderation contract

A clinic or patient participant may report one immutable opposite-party external message, private attachment, or the
whole conversation. The report accepts an actor-bound idempotency key and exactly one category:
`harassment-threats`, `spam-fraud-impersonation`, `suspected-illegal-content`, `privacy-concern`, or `other`.
`other` requires a description. Internal notes cannot be reported. Reporter identity, report text, and moderation
audit data never enter participant projections. Creating a report opens a case but never restricts content or an
identity automatically.

Platform access is additive. Only a platform staff identity with `conversation-moderation` may use the focused
moderation service. The initial read returns the reported object and the minimum necessary metadata and context. A
reasoned, audited expansion is required before reading more external conversation content; a whole-conversation report
starts with that external scope. Generic collection, REST, GraphQL, and admin browsing remains disabled. The platform
routes are `POST /api/platform/inquiry-moderation/cases/read`,
`POST /api/platform/inquiry-moderation/cases/expand-access`,
`POST /api/platform/inquiry-moderation/cases/decision`, and
`POST /api/platform/inquiry-moderation/cases/appeal-decision`.

A decision may record no action, restrict one reported content item, restrict the conversation, or suspend the
affected participant from external inquiry messaging. Sent text and attachment records remain immutable. A content
restriction preserves actor and time but replaces text with an unavailable state; an attachment restriction also
hides file name, MIME type, size, preview, and download. A conversation restriction blocks external messages from both
participants while clinic internal notes remain available. An identity suspension blocks the affected actor from
writing across all conversations but retains login, history reads, and the appeal path. The service enforces every
restriction inside the write transaction and returns `canReply: false` in current projections.

Moderation and inquiry lifecycle are independent. A moderation decision neither closes nor reopens an inquiry.
Restriction and restoration append neutral system events and may change ordering, but never create personal unread
activity. The affected participant receives only the safe category, optional measure end, and one text-only appeal;
the other participant receives only the minimum restriction state needed to explain unavailable content or disabled
messaging. An upheld appeal leaves the measure unchanged. An overturned appeal restores the original unchanged content
and appends a neutral restoration event. A later hard-delete remains terminal and is outside this contract.

Patient reporting and appeal use `POST /api/patient/inquiries/report` and
`POST /api/patient/inquiries/appeal`. Participant routes use the stable moderation errors
`MODERATION_INVALID_INPUT`, `MODERATION_UNAUTHORIZED`, `MODERATION_ACCESS_DENIED`, `MODERATION_NOT_FOUND`,
`MODERATION_CONFLICT`, `MODERATION_INVALID_STATE`, `MODERATION_RATE_LIMITED`, and
`MODERATION_SERVICE_UNAVAILABLE`. Raw case data and internal errors never cross the boundary.

The cache decision is `no-public-impact`. All inquiry communication collections, including the ephemeral transaction
lock collection, are cataloged as `private-live`; there
are no public reads, tags, paths, planner events, or public revalidation owners. This contract does not suppress a
separate public invalidation event if a future inquiry mutation gains an explicitly approved public effect.

### Inquiry retention, holds, and cutover

Inquiry retention is a separate private platform capability. Generic collection, REST, GraphQL, and admin browsing of
retention policies, legal holds, and deletion proofs remains disabled. Only a platform staff principal with the
additive `inquiry-retention` capability may use these focused routes:

| Method and route | Result |
| --- | --- |
| `POST /api/platform/inquiry-retention/review-queue` | Returns a bounded, cursor-paginated page of records whose review deadline has passed, excluding records under an active scoped legal hold. |
| `POST /api/platform/inquiry-retention/cutover` | Migrates a bounded batch of pre-communication inquiries deterministically. |
| `POST /api/platform/inquiry-retention/legal-holds/place` | Places one case-specific hold with a reason category, responsible function, and review date. |
| `POST /api/platform/inquiry-retention/legal-holds/release` | Releases one active hold without changing the record's original review deadline. |
| `POST /api/platform/inquiry-retention/content/hard-delete` | Irreversibly removes one explicitly named message or attachment after hold checks and leaves a content-free tombstone. |
| `POST /api/platform/inquiry-retention/anonymize` | Removes direct patient identifiers and identity bindings from one inquiry package while preserving separately retained communication. |
| `POST /api/platform/inquiry-retention/hard-delete` | Irreversibly removes all communication-package content and direct identity bindings after hold checks. |
| `POST /api/platform/inquiry-retention/pending-deletes/recover` | Continues a bounded, cursor-paginated batch of attachment deletes whose database intent was committed before storage cleanup finished. |

The initial policy is version `2026-08-24`. An inquiry becomes review-due 12 calendar months after its latest external
patient-clinic message, or after inquiry creation when no external message exists. Only a later external message moves
that basis. A moderation case becomes review-due 24 calendar months after its final decision or appeal and after every
effective measure has ended. Policy versions are stamped on records when they enter the domain; later policy versions
apply only to future records selected by their effective date.

A passed deadline marks a record for human review. It never deletes, anonymizes, or hides data automatically. An
active legal hold removes only the matching inquiry or moderation case from the review queue. Releasing the hold
reveals the same stored deadline again. Hold placement and release are audited, actor-derived operations; clients
cannot supply an authoritative actor or capability.

Cutover does not infer a patient from email, create a conversation, or copy the original inquiry into a second message.
Legacy `closed` maps to handling `submitted` plus lifecycle `closed` and receives exactly one clinic-only
`legacy-closed-migrated` system event. That event uses the system actor, does not affect activity ordering, and does not
change unread state. Repeating cutover is idempotent.

Clinic offboarding does not rewrite or remove patient history. When a clinic no longer has an approved, synchronized
staff principal, the patient projection remains readable but reports `messagingAvailable: false` and disables replies.
The record's timestamps, retention basis, restrictions, and policy version remain unchanged.

The focused content hard-delete route accepts only an inquiry, a message or attachment target, and an authorized reason
category. It rejects active legal holds, removes attachment objects through the private storage gateway, replaces
visible content at its original timeline position, and writes a minimal content-free proof. The proof's deterministic
opaque tombstone keeps the item deleted in projections even if a stale database restore reintroduces earlier fields.
A hard-deleted content state takes precedence over any later moderation appeal. Attachment deletion first persists a
terminal pending tombstone, then removes private storage objects, and only then finalizes the proof. An authorized
operator can resume abandoned or failed storage work through the recovery route. Its opaque cursor advances past a
fully failing batch, so later pending deletes remain reachable; a later pass from the beginning retries failures.

Patient identity anonymization nulls the patient relation, contact fields, creation actor binding, patient-authored
actor bindings, patient read position, and patient relations in moderation evidence. The clinic projection becomes
`Deleted patient`, exposes no contact action, and retains only the allowed conversation and internal-note history.
Patient account deletion is rejected until every linked inquiry has reached that terminal identity state.

Whole-package hard delete additionally removes the original request, external messages, internal notes, attachment
metadata, and private attachment objects. It retains only content-free placeholders at their original timestamps plus
the minimal technical deletion proof. Package proofs take precedence over restored application rows, and an explicit
replay re-applies the scrub. Active inquiry or moderation-case holds block both first-time operations.

All retention collections and routes are `private-live`. Responses use private no-store headers, and the cache decision
is `no-public-impact`: there are no public reads, tags, paths, planner events, revalidation owners, or public cache
flushes for review, hold, cutover, or offboarding operations.

The public `POST /api/clinic-contact-requests` route is likewise an HTTP adapter around one guest inquiry command. That
command validates the clinic and optional doctor or treatment inside its serializable transaction, deduplicates the
submission, initializes the root aggregate, and appends a content-free `inquiry-created` audit event atomically. Guest
submission creates neither a conversation nor a read position.

## Dashboard-facing Route Semantics

The Dashboard owns its same-origin routes. The paired Dashboard architecture defines their local boundaries; this
repository owns only the upstream Payload behavior they require.

| Dashboard operation | Upstream behavior |
| --- | --- |
| Initial server render | Server-only client requests the Payload bootstrap directly with the current access token. |
| Client bootstrap refresh | Same-origin Dashboard Route Handler returns the same projected bootstrap DTO. |
| Capability read | Route-specific Payload REST or custom endpoint returns a purpose-limited DTO. |
| Capability mutation | Payload validates the principal and derives clinic and actor before applying the mutation. |
| Login, callback, refresh, logout | No Payload call is required unless the Dashboard verifies the current principal after establishing or refreshing a session. |

There is no catch-all route that accepts a Payload path, collection slug, query, or arbitrary request body from the
browser.

### Review publication, response, and appeal upstream contract

The Website provides the Payload persistence and authorization contract; the Dashboard follow-up provides
purpose-limited same-origin BFF routes and UI DTOs. The Dashboard browser never calls these collections or endpoints
directly. The read-only integration for `clinic-dashboard#106` uses private, uncached BFF reads and performs no review
moderation or withdrawal mutation.

#### Review states and current reads

Appeal decisions and public review measures are independent. An `upheld` appeal changes neither the review status nor
its public output. Review publication is controlled by `publicMeasure`, while author withdrawal is controlled by
`withdrawalState`:

| State | Public text | Stars, count, date, and public author | Public clinic response |
| --- | --- | --- | --- |
| `publicMeasure=none`, `withdrawalState=active` | Original `comment` | Included | Included when independently approved and non-blocked |
| `publicMeasure=context`, `withdrawalState=active` | Original `comment` plus factual `publicNotice` | Included | Included when independently approved and non-blocked |
| `publicMeasure=redaction`, `withdrawalState=active` | Separate readable `publicComment` plus the fixed factual removal notice | Included | Included when independently approved and non-blocked |
| `publicMeasure=placeholder`, `withdrawalState=active` | Fixed neutral `publicNotice`; no review text | Included | Hidden |
| `publicMeasure=removed` | Omitted without a placeholder | Excluded | Hidden |
| `withdrawalState=withdrawn` | Omitted without a placeholder, regardless of measure | Excluded | Hidden |

There is no public `under_review` display and no black-bar rendering. `status` remains the existing
`pending | approved | rejected` approval state. Moderation and withdrawal commands never set it automatically.

The standard Payload REST collection routes remain the current-read contract:

- `GET /api/reviews` and `GET /api/reviews/:id` return platform staff all review states and fields.
- `GET /api/clinic-dashboard/clinics/:clinicId/reviews/:id` returns an ordinary exact clinic review in a closed `{ data }` envelope. It revalidates the current clinic principal and source scope, takes no query and intersects the explicit clinic path with current source authorization, and returns `404 TARGET_UNAVAILABLE` for a missing, foreign, rejected or trashed record. Its independently executable examples live in `tests/fixtures/clinic-review-detail-v1.json`. The response exposes the current permitted text projection, treatment, rating and publication/withdrawal state. Removed or withdrawn rows remain available to their clinic but omit author name and written content. The route is private and uncached; it does not read versions or create notification receipts.
- The same routes return clinic staff approved reviews only for currently eligible local or group clinics, including logically removed and
  withdrawn rows. Clinic fields are limited to the public measure/text/notice, moderation time, withdrawal
  state/source/time, rating/date/public author, and ordinary review relationships. Raw `comment` is returned only for
  active `none` or `context` rows. Internal reasons, patient relation, named audit actors, and raw redacted, placeholder,
  removed, or withdrawn text are omitted.
- Patients and anonymous callers receive only approved, active `none | context | redaction | placeholder` rows.
  Among moderation fields they receive only `publicMeasure`, `publicComment`, and `publicNotice`; field access removes
  raw text whenever the selected measure does not permit it. Removed and withdrawn reviews are absent.

`publicComment` is meaningful only for `redaction`. `publicNotice` is caller-authored only for `context`; redaction and
placeholder use Website-owned fixed notices. Empty fields may be absent or `null` according to standard Payload REST
serialization, so consumers must discriminate on `publicMeasure` rather than field presence.

#### Private clinic-target review operations

The Dashboard uses only the dedicated `/api/clinic-dashboard/clinics/:clinicId` review family. Every operation requires `X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1` and fresh current target access. Responses vary by authorization and scope contract and remain `private, no-store`.

| Operation | Contract |
| --- | --- |
| `GET /reviews` | Approved target reviews, bounded page/limit and the existing period/rating/treatment/visibility filters; unknown or duplicate query keys fail closed. Returns minimized public review projections and pagination metadata. |
| `GET /reviews/:id` | Closed exact `{ data }` detail, independent of loaded list filters and pages. |
| `GET /reviews/:id/record?depth=1` | The same permitted current review projection as a direct record for existing workflow preflight. |
| `GET /reviews/:id/publication-history` | Existing sanitized publication-history projection and revision-bound cursor. |
| `GET /review-responses` and `/review-appeals` | Only workflows for a bounded fixed set of approved reviews in the explicit target clinic. |
| `GET /review-responses/versions` and `/review-appeals/versions` | Existing permitted workflow history after current exact source authorization. |
| `POST /review-responses` and `/review-appeals` | Existing response or appeal submission; clinic and actor are source-derived. |
| `PATCH /review-responses/:workflowId` | Existing pending-response revision after exact review and workflow ownership checks. |

Commands require the configured Dashboard origin, JSON content type and a strict body bounded to 16 KiB. Native Payload access, operation permissions, computed fields, moderation transitions and versions remain authoritative. Response and appeal writes hold the actual clinic, current staff and group barriers, recheck source eligibility and ownership before commit, and serialize with assignment or group membership changes. No public projection, capture activation, retention or moderation policy changes are implied.

#### Version and publication-history reads

Reviews use unlimited, immutable Payload native versions. Raw native history remains platform-only through standard
Payload REST:

- `GET /api/reviews/versions?where[parent][equals]=<reviewId>`
- `GET /api/reviews/versions/<versionId>`

Clinic staff must not use the raw version routes because an older version can contain text that a later redaction,
removal, or withdrawal makes unsafe. The clinic-safe fallback is
`GET /api/reviews/<reviewId>/publication-history?limit=25&cursor=<opaque>`. It returns platform staff any available
review, or a currently eligible source clinic only when the current review remains approved and not physically deleted:

```ts
type ReviewPublicationHistoryResponseDTO = {
  data: {
    reviewId: number | string
    versions: Array<{
      id: number | string | null
      recordedAt: string | null
      status: "pending" | "approved" | "rejected"
      starRating: number
      reviewDate: string
      publicAuthorName: string | null
      publicMeasure: "none" | "context" | "redaction" | "placeholder" | "removed"
      withdrawalState: "active" | "withdrawn"
      withdrawalSource: "patient" | "platform" | null
      withdrawnAt: string | null
      publicText: string | null
      publicNotice: string | null
      actorType: "patient" | "platform_staff" | "system"
    }>
    pagination: {
      limit: number
      hasNextPage: boolean
      nextCursor: string | null
    }
  }
}
```

The route uses keyset pagination ordered by native version `createdAt DESC, id DESC`. `limit` defaults to `25` and
accepts only integers from `1` through `100`. There are no page numbers, offsets, or total counts. When
`hasNextPage=true`, the caller sends the returned opaque `nextCursor` unchanged with the same review ID; the final page
returns `nextCursor=null`. The cursor is versioned and bound to both the route review and the current review revision.
It never supplies or overrides authorization scope.

Authorization and clinic-tenant hiding run before query validation. Missing authentication returns
`401 UNAUTHORIZED`; authenticated principals other than platform or clinic staff receive `403 FORBIDDEN`; a missing,
physically deleted, non-approved clinic review, or review from another clinic returns `404 NOT_FOUND`. Unknown query
parameters, repeated parameters, an invalid `limit`, a malformed cursor, or a cursor from another review return
`400 INVALID_INPUT`. A review update after a cursor was issued returns `409 HISTORY_CHANGED`; the
`clinic-dashboard#106` reader must discard that cursor and its accumulated pages, then restart from the first page.
Infrastructure failures return `503 UNAVAILABLE`.

`publicText`, `publicNotice`, and `publicAuthorName` are gated by the current review state across the entire history. A
historical value is returned only when it exactly matches the currently safe public projection; superseded text,
notices, and author names stay hidden. A current removal or withdrawal exposes no historical text or notice, and a
current anonymous author preference exposes no historical author name. The DTO never contains the patient relation,
original unsafe text, internal reasons, staff identity, or actor relations. A clinic request for another tenant returns
`404`; public and patient principals receive no history access. Every response is `private, no-store`.

#### Website-owned mutations

The following Website operator/author commands are not part of the read-only Dashboard integration:

| Method and route | Authorization and effect |
| --- | --- |
| `POST /api/reviews/<id>/moderation` | Platform only. Accepts a validated `measure` and internal `reason`; context also requires `publicNotice`, redaction also requires `publicComment`. Server records actor/time and fixed notices. A withdrawn review returns `409 REVIEW_WITHDRAWN`. |
| `POST /api/reviews/<id>/withdraw` | Owning patient, or platform staff documenting a verified author request. Platform requests require `reason`; actor/time/source are server-derived. Repeated withdrawal is idempotent and creates no version. |
| `POST /api/reviews/<id>/withdrawal-correction` | Platform only with required `reason`. Reactivates an erroneously withdrawn review and records a native version; it does not change the existing public measure. |

Withdrawal is terminal until the audited platform correction. It logically removes the review, star contribution,
published response, and any future published patient addition without deleting records or versions. No patient-addition
model exists today; that final clause is a future invariant, not a field or endpoint in this contract.

#### Response and appeal reads

- `reviewResponses` contains exactly one workflow per review. Clinic staff create or edit only the pending response for
  their assigned clinic. Platform approval copies it to the public projection; rejection leaves an existing public
  response unchanged; blocking removes the public projection from public reads. Public response access additionally
  requires the parent review to be active with measure `none`, `context`, or `redaction`.
- `reviewAppeals` contains at most one appeal per review. A clinic submission is immutable. Platform staff alone move
  `submitted -> under_review -> upheld | dismissed`. The terminal state records only the appeal decision: `upheld`
  neither changes the review nor blocks or edits its clinic response. Any public review measure is a separate review
  moderation operation. Before an appeal can enter `upheld`, that operation must record an explicit measure and reason
  after the appeal was submitted; `none` is the explicit no-change decision.
- Both response and appeal collections use unlimited Payload native versions. Platform staff can read all versions,
  clinic staff can read their clinic's versions, and public or patient principals cannot read versions. Restore and
  normal physical deletion are disabled.
- Clinic and actor values are derived from the authenticated principal and related review. DTOs must not accept them as
  authoritative browser input.
- Actor audit relations are internal and nullable. Account erasure removes the relation from current and version rows;
  action type, time, workflow state, and moderation reason remain.

Public clinic-detail reads include only the approved, non-blocked response body, current clinic name, and approval
date. They never include staff identity, pending text, moderation reasons, appeal data, or version history.

All state-changing Dashboard routes use one shared mutation guard rather than route-local CSRF implementations. The
guard validates the session and exact origin, then verifies a stateless HMAC-signed CSRF token bound to the current
Supabase session. Public forms use a pre-session token; deployed cookies are host-only and secure. This protection
belongs entirely to the Dashboard BFF and requires no Payload change.

## Error Mapping

The bootstrap always returns one of these stable Payload status and code pairs:

| Payload or upstream condition | Payload result | Session effect |
| --- | --- | --- |
| Missing or invalid explicit Bearer token, non-clinic principal, conflicting identity mapping, or valid identity without matching clinic staff | `401` with `CLINIC_DASHBOARD_UNAUTHORIZED` | Dashboard may attempt one controlled refresh; persistent failure clears invalid cookies. Staff is never created during authentication. |
| Principal not eligible for personal Dashboard access | `403` with `CLINIC_DASHBOARD_ACCESS_DENIED` | Preserve the session so the Dashboard can render an access-state explanation. |
| Supabase or Payload temporarily unavailable | `503` with `CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE` | Preserve the session; do not present an upstream outage as logout. |

Capability routes additionally use these general semantics:

The Dashboard applies its one-refresh policy to the initial page read through a protected same-origin recovery form.
Its React Server Component reads Payload directly and does not mutate cookies. After a bootstrap `401`, the browser
posts to the Dashboard recovery handler, which refreshes once, retries with the new token, and propagates cookies before
returning to the page. A bounded return marker prevents another automatic refresh; persistent rejection clears local
Dashboard auth cookies before login. Writable Dashboard Route Handlers keep their existing refresh-and-retry path.
The [Dashboard initial page recovery contract](https://github.com/findmydoc-platform/clinic-dashboard/blob/main/docs/authentication-and-bff.md#initial-page-recovery-and-writable-requests)
owns these routes and guards. The recovery policy applies to the person-scoped bootstrap documented above; an empty authorized clinic set preserves the valid personal session.

| Payload or upstream condition | Dashboard BFF result | Session effect |
| --- | --- | --- |
| Invalid request input | `400 Bad Request` with a stable error code | Preserve the session. |
| Business-incomplete publish input | `422 Unprocessable Entity` with `CLINIC_PROFILE_INVALID_INPUT` | Preserve the session and keep the draft. |
| Missing active draft | `404 Not Found` with `CLINIC_PROFILE_DRAFT_NOT_FOUND` | Preserve the session and refresh the profile snapshot. |
| Conflict with current business state | `409 Conflict` with a stable error code | Preserve the session and allow a controlled refresh. |
| Payload unavailable or timed out | `502 Bad Gateway` or `504 Gateway Timeout` | Preserve the session; do not present an upstream outage as logout. |

Clinic profile address capabilities use the Payload relationship contract directly: the clinic country references the
`countries` record with ISO code `TR`, and the city references a `cities` record owned by that country. Relationship
options for clinic profile editing expose only this country and its cities. Payload rejects a different country or a
city-country mismatch even when a client submits manipulated identifiers.

Error bodies expose stable machine-readable codes and safe user-facing categories. They do not expose tokens, raw
Payload errors, SQL details, stack traces, clinic data from a denied request, or Supabase response bodies.

Every bootstrap and clinic-profile response, including errors, carries these cache headers:

```text
Cache-Control: private, no-store
Pragma: no-cache
Expires: 0
```

Bootstrap varies by Authorization, the inquiry-domain contract and the clinic-scope contract headers. Unconverted
clinic-profile routes retain their existing Authorization and inquiry-domain contract Vary values.

## Environment Matrix

| Environment | Dashboard origin | Supabase | Payload API | Callback allowlist |
| --- | --- | --- | --- | --- |
| Local | `http://localhost:3000` | Staging | Exact `https://preview.findmydoc.eu` | Exact `http://localhost:3000/auth/callback` |
| Pull-request preview | Trusted Vercel deployment URL | Staging | Exact `https://preview.findmydoc.eu` | `https://clinic-dashboard-*-findmydoc.vercel.app/auth/callback` |
| Production | `https://clinics.findmydoc.eu` | Production | Exact `https://findmydoc.eu` | Exact `https://clinics.findmydoc.eu/auth/callback` |

The Dashboard validates `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `PAYLOAD_API_URL`, and its expected origin as one
environment bundle. No service-role key is permitted. Preview origin derivation may use trusted Vercel metadata after
validating the expected project suffix and HTTPS scheme; it must not trust an arbitrary request `Host` header.

`PAYLOAD_API_URL` must equal the exact Payload origin shown for the active environment. The server-only client requires
HTTPS, treats redirects as errors, and never forwards a Bearer token after a redirect or origin change.

Payload does not add Dashboard origins to CORS. Server-to-server requests are authenticated by Bearer token and
environment, not browser-origin allowlisting.

## Cache and Data Handling

All Dashboard authentication, principal, clinic, capability, and authenticated business responses remain
`private-live` and use private, no-store semantics. The BFF does not add those reads or responses to the website's
public cache policy, tags, revalidation planner, or public discovery routes.

Request-local deduplication in one Dashboard render is allowed. Persistent Dashboard copies, ISR, shared Vercel Data
Cache entries, or stale-while-revalidate behavior for authenticated data are not allowed by this architecture.

Payload mutations that affect existing public website surfaces still execute their established ADR 023 revalidation
events, tags, and bounded paths. A private BFF response never suppresses public invalidation. This architecture adds no
new cache class, tag family, invalidation owner, or event.

An approved or blocked clinic-response change revalidates the existing clinic-detail collection, entity, surface,
surface-instance, clinic slug, and bounded clinic path. Pending edits and rejected replacements that preserve the
current public response remain private-live. Every appeal transition, including `upheld`, is private-live because it
changes neither the public review nor its response. Appeal-only seed jobs therefore have no public-cache flush scope.

## Verification Contract

The architecture remains valid only while the following properties hold:

- Browser network evidence contains Dashboard-origin application requests and authentication navigation only; it
  contains no browser request to Payload.
- Browser JavaScript cannot read access or refresh tokens.
- Payload derives current authorized clinics and capabilities from the personal principal for every request, and authorizes each explicit business target at the source.
- Bootstrap and capability DTOs contain no unapproved internal fields.
- Every state-changing Dashboard route uses the central session-bound HMAC-CSRF guard; Payload remains unchanged.
- The Payload client accepts only the exact environment origin and does not follow authenticated redirects.
- Invalid, missing, conflicting, and ineligible principals fail closed with the documented status mapping.
- Payload and Supabase outages preserve an otherwise valid Dashboard session.
- Local, preview, and production configurations reject cross-environment combinations.
- Authenticated responses bypass shared and durable caches.
- Public-impacting Payload mutations retain their established ADR 023 revalidation behavior.

## Selected-clinic doctor operations

Doctor directory and update-detail reads use `GET /api/clinic-dashboard/clinics/:clinicId/doctors` with the existing bounded Payload query shape. Doctor creation and conditional image assignment use POST and PATCH on that path; exact updates use PATCH `/:id`. Specialty reads and creation use `/doctor-specialties`; exact updates use `/doctor-specialties/:id`. Doctor image upload and cleanup use POST `/doctor-media` and DELETE `/doctor-media/:id`. These requests retain ordinary collection access and return private, uncached responses, including errors. A caller-supplied query is combined with the source clinic constraint and cannot broaden it.

`GET /api/clinic-dashboard/clinics/:clinicId/doctors/:id/image` resolves the current doctor profile image, actual media doctor and clinic before reading its same-origin Payload file. It forwards the verified server-side bearer only to that configured origin, rejects redirects and unsupported formats, and bounds image reads to 5 MiB. Existing upload validation remains 4 MiB with its existing accepted formats. Public media file access remains governed by the existing publication policy.

The source derives current local/group eligibility through `readClinicPrincipalAccess` and `readClinicTargetAccess`; path and body identifiers only select records. Direct `doctors`, `doctorspecialties`, `doctortreatments` and `doctorMedia` collection operations use the same source policy. Doctor clinic ownership cannot be reassigned by clinic staff. Specialty/treatment joins retain their real doctor parent, controlled reference validation and existing platform-only delete policy. Doctor images retain immutable doctor ownership and must belong to both the selected doctor and clinic. Existing platform cleanup of historical media remains possible. A group principal must explicitly select a creation clinic, even when its eligible set has one member.

`src/features/doctorProfiles/authorization.ts` supplies the native `guardDoctorOperation`, `guardDoctorChange` and `verifyDoctorOperation` hooks. Payload starts the outer transaction before `beforeOperation`; nested ownership lookups carry the same request. Original and proposed clinic sources acquire the shared clinic/group/person barriers, and final current authorization runs before native commit. Missing native ownership fails closed. No runtime SQL, isolation override or new retry loop is introduced. These are doctor-child hooks; they do not convert clinic treatments or master specialty/treatment management.

Cache impact is `public-cached`: the existing Doctor and DoctorSpecialty change/delete hooks retain old/new source identities and dispatch the existing clinic-surface planner events. Existing Clinic Detail/Listing tags and bounded paths remain Website-owned. Private directory, editor, image and authorization state stays live and is never placed in a public cache.
