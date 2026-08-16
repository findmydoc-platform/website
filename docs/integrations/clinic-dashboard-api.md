# Clinic Dashboard Application and API Architecture

> **Canonical decision:**
> [ADR 026](https://github.com/findmydoc-platform/website/blob/main/docs/adrs/026-adr-standalone-clinic-dashboard-bff-architecture.md)
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
treatment contract, and the clinic-gallery contract. The Clinic Dashboard session and BFF runtime are implemented in
the Dashboard repository; trusted preview and production rollout evidence remain pending.

## Boundary and Ownership

| Concern | Website and Payload | Clinic Dashboard |
| --- | --- | --- |
| Identity validation | Validate the Supabase access token against the matching environment. | Complete server-side password login or explicitly confirmed TokenHash invite/recovery, then store and refresh the user session in host-bound `HttpOnly` cookies. |
| Current principal | Resolve `clinicStaff`, status, clinic assignment, and access on every request. | Treat the returned principal and capabilities as authoritative for the current request only. |
| Business authorization | Enforce collection and endpoint permissions; derive clinic and actor from the principal. | Never send an authoritative clinic, role, or actor value. |
| Browser API | Not exposed to the Dashboard browser. | Expose capability-specific, same-origin Route Handlers. |
| Server rendering | Provide typed Payload REST and custom endpoint contracts. | Read through a server-only Payload client directly from React Server Components. |
| Persistence | Remain the sole business-data persistence boundary. | Own no database or durable business cache. |

## Payload Bootstrap Contract

The initial focused endpoint is `GET /api/clinic-dashboard/bootstrap`. Payload registers it through its standard custom
endpoint conventions; its stable semantic contract is fixed here.

The endpoint:

1. validates the Bearer token through the existing Supabase authentication strategy;
2. accepts only a resolved `clinicStaff` principal;
3. reads current approval and clinic assignment from Payload;
4. returns `403` without clinic data when the principal is not approved or has no clinic;
5. derives all capabilities server-side from current access rules;
6. returns a purpose-specific DTO, not a populated Payload document.

The initial response shape is owned by the website repository:

```ts
type ClinicDashboardCapability =
  | 'clinic-profile:view'
  | 'clinic-profile:edit'
  | 'clinic-treatments:view'
  | 'clinic-treatments:edit'
  | 'clinic-gallery:view'
  | 'clinic-gallery:edit'

type ClinicDashboardBootstrapDTO = {
  principal: {
    id: string
    displayName: string
    email: string
  }
  clinic: {
    id: string
    name: string
  }
  status: "approved"
  capabilities: ClinicDashboardCapability[]
}
```

The six capabilities are returned exactly once in the order shown above for every approved clinic principal with a
current clinic assignment. Existing profile view and edit access respectively grant treatment and gallery view and edit
access while those workspaces are introduced. A successful bootstrap implies Dashboard access, so there is no separate
`dashboard:access` capability.

`ClinicDashboardCapability` is a closed, version-controlled string union. It describes user-visible operations, not
Payload collection names or field-level access details. It is a UI projection and never replaces Payload authorization:
each later read or mutation must authorize the current principal, clinic, document, and fields again. New capability
values require synchronized type, endpoint, Dashboard behavior, and permission tests.

The DTO deliberately omits Supabase identifiers, tokens, internal roles, access-control metadata, Payload timestamps,
and unrelated clinic fields. Later capability endpoints may add their own DTOs without expanding this bootstrap into a
generic data endpoint.

## Clinic Profile Draft Contract

The profile capability uses five custom Payload endpoints:

| Method and route | Result |
| --- | --- |
| `GET /api/clinic-dashboard/profile` | Returns the current published profile, the optional active draft, and safe Türkiye city options. |
| `POST /api/clinic-dashboard/profile/draft` | Creates the assigned clinic's active draft from the current published profile after a published-revision check. |
| `PUT /api/clinic-dashboard/profile/draft` | Replaces the assigned clinic's active draft after published- and draft-revision checks. |
| `POST /api/clinic-dashboard/profile/draft/discard` | Deletes the assigned clinic's active draft after a draft-revision check. |
| `POST /api/clinic-dashboard/profile/publish` | Atomically applies the draft-owned fields to the public clinic, deletes the draft, and triggers the established clinic revalidation plan. |

Every request repeats bootstrap authorization and derives the clinic from the current approved `clinicStaff`
assignment. No route accepts a clinic ID as authority. Payload stores at most one active `clinicProfileDrafts` record
per clinic.

Draft creation accepts only `{ expectedPublishedRevision }`. The server copies the current published name,
description, public postal address, supported languages, and opening hours into revision `1`; callers cannot supply
initial field values or a clinic ID. Draft updates require the complete draft-owned field set plus
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
- The same routes return clinic staff approved reviews only for their assigned clinic, including logically removed and
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

#### Version and publication-history reads

Reviews use unlimited, immutable Payload native versions. Raw native history remains platform-only through standard
Payload REST:

- `GET /api/reviews/versions?where[parent][equals]=<reviewId>`
- `GET /api/reviews/versions/<versionId>`

Clinic staff must not use the raw version routes because an older version can contain text that a later redaction,
removal, or withdrawal makes unsafe. The clinic-safe fallback is
`GET /api/reviews/<reviewId>/publication-history?limit=25&cursor=<opaque>`. It returns platform staff any available
review, or the currently assigned clinic only when the current review remains approved and not physically deleted:

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
| Principal not approved or missing a current clinic assignment | `403` with `CLINIC_DASHBOARD_ACCESS_DENIED` | Preserve the session so the Dashboard can render an access-state explanation. |
| Supabase or Payload temporarily unavailable | `503` with `CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE` | Preserve the session; do not present an upstream outage as logout. |

Capability routes additionally use these general semantics:

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

Every bootstrap and clinic-profile response, including errors, carries:

```text
Cache-Control: private, no-store
Pragma: no-cache
Expires: 0
Vary: Authorization
```

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
- Payload resolves clinic, status, and capabilities from the current principal for every request.
- Bootstrap and capability DTOs contain no unapproved internal fields.
- Every state-changing Dashboard route uses the central session-bound HMAC-CSRF guard; Payload remains unchanged.
- The Payload client accepts only the exact environment origin and does not follow authenticated redirects.
- Invalid, missing, conflicting, and ineligible principals fail closed with the documented status mapping.
- Payload and Supabase outages preserve an otherwise valid Dashboard session.
- Local, preview, and production configurations reject cross-environment combinations.
- Authenticated responses bypass shared and durable caches.
- Public-impacting Payload mutations retain their established ADR 023 revalidation behavior.
