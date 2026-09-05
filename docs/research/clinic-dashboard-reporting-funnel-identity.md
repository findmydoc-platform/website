# Clinic dashboard funnel identity and session foundation

Date: 2026-09-05

## Research question

What is the smallest reliable identity and session contract that lets the clinic dashboard report a real, consent-limited funnel from `clinic_profile_viewed` to `patient_inquiry_created`?

This note uses the public PostHog contract and the repository state on this branch. It does not inspect production events or PostHog project settings.

## Decision in brief

Use a unique browser session as the V1 funnel entity. Carry the browser SDK's current `distinct_id` and `$session_id` through the successful inquiry request, then attach both values to the server-side `patient_inquiry_created` event. Aggregate the funnel by `properties.$session_id`.

The primary funnel should have two ordered steps:

1. `clinic_profile_viewed`
2. `patient_inquiry_created`

`clinic_cta_clicked` is a diagnostic step in a separate three-step funnel. It must not be required in the primary funnel because the rendered clinic flow can submit after choosing a doctor or treatment without first firing the tracked contact CTA.

This is a consent-limited session funnel, not a count of all clinic visitors and not a verified person funnel. The browser identifiers are analytics correlation data. They must never authorize a request, select a tenant, or override the clinic stored on an accepted inquiry.

## Provider facts

### Identity

- PostHog assigns a new browser an anonymous ID and stores it locally. Calling `identify` with a stable application ID links the anonymous and identified histories. PostHog warns that non-unique `distinct_id` values merge different users. [PostHog: identifying users](https://posthog.com/docs/product-analytics/identify)
- Backend SDKs do not share the browser's anonymous identity automatically. PostHog requires the application to pass the same `distinct_id` from frontend to backend for one continuous identity. [PostHog: identity carried to the backend](https://posthog.com/docs/product-analytics/identify#carried-to-the-backend)
- `posthog.get_distinct_id()` returns the browser's current PostHog ID. [PostHog: get the current user's distinct ID](https://posthog.com/docs/product-analytics/identify#get-the-current-users-distinct-id)
- PostHog's current Node documentation describes `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` as request context. It also states that these headers are client-controlled analytics context, not authentication or authorization. [PostHog: Node request context](https://posthog.com/docs/libraries/node#request-context)

### Sessions

- The JavaScript SDK adds `$session_id` to browser events. The value remains stable for events from the same browser session. By default, 30 minutes without activity or a maximum duration of 24 hours starts a new session. Tabs in the same browser can share the session. Another browser and `posthog.reset()` start a new one. [PostHog: sessions](https://posthog.com/docs/data/sessions#how-does-posthog-define-a-session)
- Server SDKs do not add `$session_id` by default. PostHog recommends reusing the frontend session ID when a backend event completes a frontend action. The browser exposes it through `posthog.get_session_id()`. [PostHog: server SDKs and sessions](https://posthog.com/docs/data/sessions#server-sdks-and-sessions)
- PostHog only includes custom session IDs in session aggregations when they are valid UUIDv7 values and satisfy its consistency and timestamp constraints. Reusing the SDK-generated value avoids inventing another session algorithm. [PostHog: custom session IDs](https://posthog.com/docs/data/sessions#custom-session-ids)
- PostHog's current funnel query contract supports unique-session aggregation through `funnelAggregateByHogQL: 'properties.$session_id'`. The same contract defaults the conversion window to 14 days unless the query sets it explicitly. [PostHog funnel query schema](https://github.com/PostHog/posthog/blob/master/frontend/src/queries/schema/schema-assistant-queries.ts#L3535-L3577)

### Consent

- Opting out prevents manual events, autocapture, and session replay from reaching PostHog. PostHog recommends initializing the SDK opted out, then calling `opt_in_capturing()` or `opt_out_capturing()` when the consent state changes. [PostHog: controlling data collection](https://posthog.com/docs/privacy/data-collection#using-posthog-with-a-consent-management-platform-cmp)
- Events that happen before opt-in are absent. Enabling capture later does not reconstruct them. This follows directly from PostHog's rule that an opted-out client sends no events. [PostHog: opting in and out](https://posthog.com/docs/privacy/data-collection#opting-in-and-out)

### Funnel behavior

- PostHog funnels are sequential by default. A later step may have unrelated events between it and the previous step. Strict order requires the steps to be adjacent, while any-order funnels ignore sequence. Repeating the same event as two steps requires two occurrences. [PostHog: funnel steps and ordering](https://posthog.com/docs/product-analytics/funnels#adding-steps)
- PostHog can hide recent funnel periods whose full conversion window has not elapsed. [PostHog: funnel historical trends](https://posthog.com/docs/product-analytics/funnels#graph-type)

## Current repository facts

### The browser events already share a PostHog session

`clinic_profile_viewed` and `clinic_cta_clicked` use the browser SDK through the typed facade. PostHog enriches those captures with the current browser `distinct_id` and `$session_id`. The business event payload does not need duplicate custom identity fields.

Sources:

- [`src/posthog/client.ts`](../../src/posthog/client.ts)
- [`src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx`](../../src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx)

### The current inquiry path does not preserve that correlation

The rendered clinic detail submits guest inquiries to `/api/clinic-contact-requests` and authenticated inquiries to `/api/patient/inquiries`. Its `fetch` sends JSON only. Neither current creation path calls `patientInquiryCreated`.

The only product-code call to `patientInquiryCreated` is the form bridge. That route chooses `form_submission:<submissionId>` before the PostHog ID parsed from the request cookie. Its server capture also has no `$session_id`. An event emitted there therefore cannot join the profile-view browser session.

Sources:

- [`src/components/templates/ClinicDetailConcepts/hooks/useClinicDetailInteractionState.ts`](../../src/components/templates/ClinicDetailConcepts/hooks/useClinicDetailInteractionState.ts)
- [`src/app/api/clinic-contact-requests/route.ts`](../../src/app/api/clinic-contact-requests/route.ts)
- [`src/endpoints/patientInquiries.ts`](../../src/endpoints/patientInquiries.ts)
- [`src/app/api/form-bridge/[slug]/route.ts`](../../src/app/api/form-bridge/%5Bslug%5D/route.ts)
- [`src/posthog/api.ts`](../../src/posthog/api.ts)

### Authenticated server identity is not browser identity

The server facade resolves an authenticated actor to the Supabase user ID. The repository identifies that actor through the Node SDK, but it does not call browser-side `posthog.identify` for the same user. Simply adding the current server facade to `/api/patient/inquiries` would therefore create a different `distinct_id` from the preceding anonymous browser events.

For this V1 session funnel, authentication and analytics correlation must remain separate. The authenticated endpoint still authorizes the patient with its existing Supabase context. The inquiry event uses the browser analytics IDs only to join consented events.

Sources:

- [`src/posthog/api.ts`](../../src/posthog/api.ts)
- [`src/posthog/identify.ts`](../../src/posthog/identify.ts)
- [`src/auth/strategies/supabaseStrategy.ts`](../../src/auth/strategies/supabaseStrategy.ts)

### Existing cookies are readable but are not a durable identity contract

The server currently locates a cookie whose name matches `ph_phc_.*?_posthog`, decodes JSON, and reads `distinct_id`. The test suite demonstrates that any matching request cookie with JSON such as `{"distinct_id":"attacker-controlled"}` passes this parser. The helper does not validate the project token, cookie name, signature, length, or identifier shape.

The findmydoc consent cookie is also written by browser JavaScript without `HttpOnly`. The server validates its shape and configured consent version, which is appropriate for a consent preference. Neither browser-writable cookie proves a user identity or a tenant relationship.

The implementation can continue reading the consent cookie for the consent gate. It should stop treating PostHog's internal persistence cookie shape as the cross-stack correlation API. Use the SDK's public getters and explicit, narrowly scoped headers on the two inquiry requests.

Sources:

- [`src/posthog/telemetry.ts`](../../src/posthog/telemetry.ts)
- [`tests/unit/posthog/telemetry.test.ts`](../../tests/unit/posthog/telemetry.test.ts)
- [`src/features/cookieConsent/cookie.ts`](../../src/features/cookieConsent/cookie.ts)
- [`src/posthog/serverConsent.ts`](../../src/posthog/serverConsent.ts)

### Late consent currently loses the profile-view step

The clinic detail effect writes its deduplication key before it tries to capture `clinic_profile_viewed`. If the SDK is not initialized or capture is disabled, the typed browser capture returns `false`, but the component still considers the view tracked. Later consent initializes PostHog without changing the effect dependencies, so that mounted profile view is not retried.

Consent withdrawal calls `opt_out_capturing()` and `reset()`. A later opt-in starts with a new anonymous identity and session. This is a valid privacy boundary, but the reporting contract must not claim continuity across the withdrawn interval.

Sources:

- [`src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx`](../../src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx)
- [`src/posthog/client.ts`](../../src/posthog/client.ts)
- [`src/components/organisms/CookieConsent/useCookieConsentController.ts`](../../src/components/organisms/CookieConsent/useCookieConsentController.ts)
- [`src/features/cookieConsent/useCookieConsentToolAllowed.ts`](../../src/features/cookieConsent/useCookieConsentToolAllowed.ts)

### The inquiry service owns authoritative clinic validation

Both current creation paths validate that the clinic exists and is approved. They also validate that a selected doctor or treatment belongs to that clinic. The creation service then stores the validated `clinicId` on the inquiry. This service result, not a correlation header and not a request-supplied analytics property, is the tenant fact that the event and report filter must use.

Sources:

- [`src/features/inquiryCommunication/service.ts`](../../src/features/inquiryCommunication/service.ts)
- [`src/app/api/clinic-contact-requests/route.ts`](../../src/app/api/clinic-contact-requests/route.ts)
- [`src/endpoints/patientInquiries.ts`](../../src/endpoints/patientInquiries.ts)

## Recommended V1 contract

### Funnel entity and query

| Field | V1 decision |
| --- | --- |
| Population | Events captured after valid PostHog analytics consent |
| Entity | Unique `$session_id` |
| Primary steps | `clinic_profile_viewed` then `patient_inquiry_created` |
| Order | Sequential, not strict |
| Conversion window | Explicit 24 hours, with the shared session ID providing the tighter normal boundary |
| Tenant filter | Authoritative `clinic_id` on every step |
| Cohort time | Time of `clinic_profile_viewed` |
| Recent cohorts | Exclude until the full 24-hour window has elapsed |
| CTA analysis | Separate three-step diagnostic funnel |

The 24-hour cap matches PostHog's maximum browser session duration and removes the unrelated 14-day default. The normal 30-minute inactivity rule will split most separate visits before that cap. A future tracked-browser funnel may use a longer window, but it would answer a different question: whether a consented browser returned and inquired later.

### Correlation transport

Add one read-only method to the browser facade that returns `{ distinctId, sessionId }` only when PostHog is initialized and capture is enabled. Obtain the values from `get_distinct_id()` and `get_session_id()`.

The guest and authenticated inquiry requests should attach the snapshot as `X-PostHog-Distinct-Id` and `X-PostHog-Session-Id`. The server accepts them only after its independent consent check succeeds. It validates a bounded non-empty distinct ID and a UUIDv7 session ID, then passes them as analytics capture context. Invalid or absent values skip the funnel event instead of collapsing visitors into a shared `anonymous` identity.

The server capture facade needs an optional `sessionId` field outside the governed business-event payload. It writes that value as the reserved `$session_id` property. The business event contract remains free of custom identity fields.

### Inquiry capture placement

Emit `patient_inquiry_created` from the successful current creation paths, after domain validation and durable inquiry creation. Use the stored inquiry ID and clinic relation. Do not emit on validation failures, authorization failures, or idempotent replays. Both guest and authenticated flows need the same event semantics.

The form bridge's legacy clinic-inquiry branch should not remain a second producer once the current endpoints own the event. Two producers would make event counts dependent on which UI submitted the inquiry and would risk duplicates.

### Consent transitions

Use the existing reactive consent hook on the clinic detail. Attempt the profile-view capture only while PostHog consent is allowed, and set the component deduplication key only when capture returns `true`. This gives late consent one honest profile-view event for the still-mounted page.

The state transitions are:

| Transition | Required behavior |
| --- | --- |
| No decision to accepted | Initialize capture, record the mounted profile once, expose correlation for later inquiry |
| Rejected to accepted | Start a new consented identity/session, record the mounted profile once |
| Accepted to rejected | Stop capture and reset identity; send no further correlation |
| Rejected throughout | Send neither funnel events nor correlation IDs |
| Accepted inquiry after an untracked view | Emit the inquiry event, but leave it unmatched rather than inventing a profile view |

The response remains explicitly `population: consent_limited`. Missing pre-consent activity is undercounting, not source downtime and not zero activity.

## Direct inquiry and repeated events

The primary two-step funnel includes a session that views the clinic and submits successfully, whether or not `clinic_cta_clicked` occurred. A CTA can select or scroll, but it is not the business outcome.

Repeated profile views or CTA clicks in one session do not multiply the number of funnel entrants when the query aggregates by `$session_id`. An idempotent inquiry replay must not create a second completion. A new session is a new funnel entity, even when the same browser visited before.

## Spoofing and tenant boundaries

The two correlation headers are intentionally forgeable in the same way as other browser analytics fields. Validation limits malformed input and accidental merging, but it does not make the values trustworthy.

The safe boundary is concrete:

- existing application authentication authorizes authenticated inquiries;
- the inquiry service validates and stores the clinic relation;
- event `clinic_id` comes from the accepted service result;
- the dashboard derives the allowed clinic from its authenticated server context and applies that filter to every funnel step;
- no application behavior, access decision, record lookup, clinic selection, or patient merge uses PostHog correlation IDs.

A forged valid correlation value can at most pollute consent-limited analytics for an inquiry that passed the normal creation rules. Rate limits and abuse controls remain inquiry-endpoint concerns, not identity semantics for the dashboard.

## Synthetic acceptance evidence

Implementation can prove the contract without production PostHog access:

1. With consent enabled, mock the browser SDK getters and verify that guest and authenticated inquiry requests send the same `distinct_id` and `$session_id` that enriched the preceding profile event.
2. With consent absent or withdrawn, verify that neither request sends correlation headers and neither server path captures `patient_inquiry_created`.
3. Change consent from rejected to accepted while a clinic profile remains mounted. Verify exactly one successful `clinic_profile_viewed` capture after opt-in.
4. Submit an inquiry without a tracked CTA. Feed synthetic events with one shared session ID to the funnel query and verify that the two-step funnel converts while the three-step diagnostic funnel does not.
5. Send repeated profile and CTA events with one session ID. Verify one unique-session entrant and one conversion.
6. Replay the same authenticated idempotency key or guest request hash. Verify one inquiry event for the initial creation and none for the replay.
7. Send a malformed session ID, a missing distinct ID, and the literal ID `anonymous`. Verify that the server skips funnel capture and does not merge the cases.
8. Send valid-looking forged correlation headers with a clinic ID that conflicts with the accepted inquiry. Verify that the event uses the stored clinic relation and that dashboard queries filter every step by the authenticated clinic.
9. Use UUIDv7 session fixtures on both sides of the 30-minute inactivity boundary. Verify same-session conversion for the first pair and separate funnel entities for the second pair.
10. Run a historical funnel fixture whose entry cohort is less than 24 hours old. Verify that reporting marks or excludes it as incomplete rather than reporting a final conversion rate.

## HITL decision tree

```text
What question should the headline funnel answer?
|
+-- "Did a consented clinic-profile visit produce an inquiry in that visit?"
|   |
|   +-- Choose unique $session_id aggregation. Recommended V1.
|       Use profile -> inquiry, ordered, explicit 24-hour cap.
|
+-- "Did the same consented browser inquire across one or more visits?"
    |
    +-- Choose distinct_id aggregation.
        Requires a separate conversion-window decision and a "tracked browser" label.

Should CTA interaction be required?
|
+-- No. Recommended for the primary outcome funnel.
|   Use profile -> inquiry.
|
+-- Yes.
    Use a separate diagnostic profile -> CTA -> inquiry funnel.
    It excludes valid direct inquiries by design.

Should rejected visitors be counted through cookieless tracking?
|
+-- No. Recommended within the accepted consent contract.
|   Keep population = consent_limited and do not estimate missing events.
|
+-- Yes.
    Stop. This changes the privacy and consent decision and needs separate approval.

May browser analytics IDs influence authorization or tenant selection?
|
+-- No. Required safety boundary.
|
+-- Yes.
    Stop. Client-controlled PostHog context is not an identity credential.
```

The recommended branch is implementable without choosing a patient-level identity strategy. It produces a real aggregate funnel for consented sessions while preserving the existing application authentication and clinic-ownership boundaries.

