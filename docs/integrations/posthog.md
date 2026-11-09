# PostHog Integration

PostHog is the findmydoc analytics, replay, error-tracking, and operational guard-flag provider.

## Scope

- Browser analytics, replay, and error tracking run through the consent-controlled browser facade.
- Server-side business events run through the typed server facade and require analytics consent.
- Server-side guard flags control temporary public access behavior.

## Setup

### Environment Variables

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
POSTHOG_FEATURE_FLAGS_SECURE_API_KEY=phx_xxx
POSTHOG_QUERY_API_KEY=phx_xxx
POSTHOG_QUERY_PROJECT_ID=12345
POSTHOG_QUERY_RETENTION_DAYS=180
```

> **Note:** The project targets the EU host (`https://eu.i.posthog.com`); keep that consistent in documentation and deployments.
> **Security:** `POSTHOG_FEATURE_FLAGS_SECURE_API_KEY` is a server-side secret for local feature flag evaluation. Store it in Vercel environment variables or a secrets manager, not in PayloadCMS.
> **Reporting Query API:** `POSTHOG_QUERY_API_KEY` is a separate server-only personal API key with Query Read access.
> `clinic-dashboard-reporting-v3` sends one aggregate HogQL query per load to [PostHog's documented Query API](https://posthog.com/docs/api/queries),
> requests `refresh: force_blocking`, times out after three seconds, and never retries. Configure retention for at
> least 180 days for a 90-day report and its comparison; verified capture start is also required for coverage. Do not expose this key
> to the browser or use browser credentials.

## Architecture

### File Organization

```
src/posthog/
├── api.ts            # Public server facade for flags, identity, and typed business events
├── client-api.ts     # Public browser facade for consent and typed business events
├── client.ts         # Internal browser PostHog client
├── exception-context.ts # Exception property and request-path sanitization
├── events.ts         # Business event registry and event payload contracts
├── index.ts          # Main server-safe exports
├── server.ts         # Internal server PostHog client (Node.js 24.x runtime)
├── flag-definition-cache.ts # Vercel Runtime Cache adapter for local flag definitions
├── identify.ts       # Smart user identification
└── client-only.ts    # Safe client imports
```

### Business Event Catalog

Business event names and payload contracts are registered in `src/posthog/events.ts`. Product code must not call raw SDK capture methods or pass custom event-name strings. Server code uses `postHogServerEvents` from `@/posthog/api`; browser code uses `postHogBrowserEvents` from `@/posthog/client-api`.

| Event                                | Trigger                                                          | Required payload                                                                               | Optional payload                                                                                                                       | Privacy note                                                                                     | Analysis                                                          |
|--------------------------------------|------------------------------------------------------------------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| `clinic_inquiry_started` | Own substantive inquiry form edit after consent | `clinic_id` | None | No field values, medical selections, contact content or free text. | Internal consent-controlled form interaction capture; excluded from clinic reporting. |
| `clinic_search_result_viewed` | Clinic result visible in the active viewport, once per result-view instance | `clinic_id` | None | No search terms, medical selections or contact content. | Actual search-result visibility. |
| `clinic_profile_viewed`              | Consent-eligible public clinic profile view in the browser       | `clinic_id`, `clinic_slug`, `page_path`, `source_route`                                        | `has_doctors`, `has_treatments`, `verification_tier`                                                                                   | Clinic metadata only. No visitor contact details or medical data.                                | Clinic profile reach and entry-volume analysis.                   |
| `clinic_onboarding_interest_created` | Clinic partner contact form accepted by the form bridge          | `form_slug`, `page_path`, `source_route`                                                       | `has_message`, `submission_id`                                                                                                         | No contact details or submitted message content.                                                 | Clinic partner landing conversion analysis.                       |
| `register_clinic_submitted`          | Clinic registration application created or deduplicated          | `source_route`, `submission_status`                                                            | `country`, `has_additional_notes`, `has_contact_phone`                                                                                 | No clinic contact person, email, phone, street address, or additional notes content.             | Clinic registration submission and duplicate-submission analysis. |

Server-side business event capture is gated by PostHog analytics consent. Operational submissions still complete when
analytics consent is absent; only PostHog event capture is skipped.

### Holding mode flag

The repository registers the server-side PostHog flag `temporary-landing-mode` for public Holding mode.
It is evaluated through `evaluatePostHogFlags()` with a stable host actor and the `feature_flag_site_host`
person property. With valid analytics consent, request evaluation also supplies the existing browser distinct ID as `feature_flag_browser_id`, the verified Supabase user ID as `feature_flag_user_id`, and the verified `app_metadata.user_type` as `feature_flag_user_type`. Missing or ineligible attributes are empty strings. The user types are `patient`, `clinic`, and `platform`; client-controlled user metadata is not used. An evaluated boolean selects Holding or Full. Unavailable or invalid evaluation uses
`PUBLIC_SITE_FALLBACK_MODE`; missing or invalid fallback configuration selects Holding. Browser-side
feature-flag evaluation is disabled.

To release a browser on a Holding host, first obtain its distinct ID from its own browser after allowing analytics.
In DevTools, inspect the `ph_phc_*_posthog` cookie and copy `distinct_id` from its decoded JSON. The first
request before the SDK creates this cookie still uses the host decision. Do not share the cookie or its other contents.

Edit the existing `temporary-landing-mode` boolean flag in PostHog. In each Holding condition for the relevant host,
add the person property `feature_flag_browser_id` with operator **is not** and the selected ID or list of IDs. Keep
the host condition and its existing rollout percentage. This excludes selected browsers from that Holding condition,
so they receive false (Full), while other browsers and requests without an ID still match the host condition. Conditions
are ORed: another matching Holding condition can override the exclusion, so update each applicable condition. Local
evaluation requires properties supplied by the application; remote person profiles and unsupported rules cannot be
assumed available. Keep the host actor and avoid changing rollout percentages, which would change existing assignments.

To release signed-in users, add `feature_flag_user_id` **is not** with the selected verified Supabase user IDs to each applicable Holding condition. To release a user category, add `feature_flag_user_type` **is not** with the selected types. Add these properties to the same condition as the browser exclusion: all properties in that condition must match, so any selected browser, user ID, or user type receives Full. Other matching Holding conditions still take precedence. User selection requires analytics consent and successful server-side authentication. It works without a browser identifier; an eligible browser remains released after sign-in or an authentication outage. Signing out ends user selection, and the existing logout identity reset replaces the browser identifier.

Verify the selected browser after a new request, and check a separate browser without the ID on the same host. Verify
that withdrawing consent restores the host mode. Check a selected signed-in user and an unmatched user, then sign out and check again. Remove an ID or type from every applicable exclusion to revoke its release.
Definition changes normally take several minutes to propagate; an outage can extend use of older definitions. Existing
open pages do not update automatically. A flag is not an authorization mechanism.

### Browser consent lifecycle

`src/posthog/client.ts` owns the browser SDK instance. Initialization, the site's consent decision, and confirmed
capture readiness are separate. The SDK initializes with capture disabled by default. Readiness requires its loaded
callback, the configured project token, and a confirmed SDK opt-in. Missing configuration or SDK/storage errors keep
application event capture closed. Readiness does not wait for remote configuration.

The browser facade exposes `usePostHogAnalyticsReady()` without exposing the SDK. The clinic route adapter passes
readiness to the presentation analytics port. The displayed clinic profile captures once after readiness, and only a
successful SDK capture marks that view as tracked. Earlier profiles are not queued. Withdrawing and restoring
consent does not replay a profile already captured by the mounted view.

Withdrawal closes application capture immediately, resets identity, and then writes the final SDK opt-out. Reconsent
reuses the initialized instance. Logout resets identity and reapplies the existing site consent decision. The site cookie
and consent controls remain the authority for that decision.

The consent manager uses `initialConsent` only for the initial HTML snapshot. All banner and launcher actions are
natively disabled until client initialization reads the current versioned browser cookie. The browser adapter injects
that read into the controller. Refreshed server props or equivalent category references cannot replace a stored choice.
A new consent version requires a new choice. The manager verifies each write by reading the cookie back; an absent,
unreadable, or mismatched cookie leaves analytics disabled. After a failed write, the mounted controller keeps analytics
disabled until a later choice is successfully persisted, including across server prop refreshes.

Browser DevTools can read the hidden `[data-analytics-diagnostics]` element before and after login, on a clinic profile,
and on other consent-controlled pages:

```js
JSON.parse(document.querySelector('[data-analytics-diagnostics]').getAttribute('data-analytics-diagnostics'))
```

The snapshot contains only `cookieValid`, `analyticsAllowed`, `sdkReady`, and `sessionAvailable` booleans plus `reason`.
`cookieValid` means the current cookie matches the configured consent version. `analyticsAllowed` is the consent decision
applied by the controller; `sdkReady` is the confirmed application capture gate. `sessionAvailable` reports only whether
the consent-gated session getter can return a valid ID. It never reads a session before consent. The fixed reasons are
`consent_uninitialized`, `cookie_invalid`, `consent_required`, `sdk_unavailable`, `sdk_loading`,
`sdk_consent_unconfirmed`, `session_unavailable`, and `ready`. The snapshot updates after consent reconciliation and SDK
readiness changes. It contains no cookie contents, session IDs, user details, credentials, raw SDK, or network endpoints,
and it emits no analytics events. `ready` confirms local readiness; it does not prove successful event transport.

The consent tests use the installed `posthog-js` implementation and the real consent controller and clinic composition.
All network transports are intercepted. The headed Chrome transport test is opt-in because it needs a graphical browser:

```bash
POSTHOG_BROWSER_TEST=1 pnpm exec vitest run --project unit tests/unit/posthog/client-consent.browser.test.ts
```

It bundles the browser components in isolation, without starting Next.js or connecting to Payload. The intended assertions inspect actual outgoing event bodies before consent, after consent, after withdrawal, and after
reconsent. The installed SDK rejects WebDriver-controlled browsers, including headed Chrome, before event transport.
The browser test reports a skip when that prerequisite blocks capture. This is a test limitation, not successful transport
evidence. SDK bot filters and browser identity remain unchanged. Live capture in an ordinary browser and PostHog reporting
reconciliation require a separate acceptance run.

### User Identification

- Authenticated users are identified through the Supabase auth strategy.
- Logout resets browser PostHog identity to prevent session mixing.
- Anonymous browser analytics remain consent-controlled.

### Integration Points

- `src/auth/strategies/supabaseStrategy.ts` - User identification on auth
- `src/instrumentation.ts` - Server-side error tracking
- `src/instrumentation-client.ts` - Client-side initialization

### Server Exception Deployment Context

Server-side exceptions use the deployment contract supplied by the deployment workflow, not provider-specific runtime
variables. Production requires `DEPLOYMENT_ENVIRONMENT=production`, a full lowercase
`DEPLOYMENT_COMMIT_SHA`, and the shared `RELEASE_VERSION` in `vX.Y.Z` form. Preview requires
`DEPLOYMENT_ENVIRONMENT=preview` and its built commit SHA, and must not set `RELEASE_VERSION`.

Captured server exceptions always use `application=website` and `server:website` as the server-side distinct ID. Their
properties include `deployment_environment` and `deployment_commit_sha`; production additionally includes
`release_version`. Caller-provided properties cannot replace these values.

Next.js requires asynchronous work in `onRequestError` to be awaited. Exception capture therefore has a fixed 1.5-second
budget, catches every telemetry failure, and never changes the original error status or body. A slow telemetry provider can
delay completion of an already failing request only until that budget expires.

Development and tests do not create a PostHog client or send network telemetry. They write the same sanitized exception
context to the server log with `event=telemetry.posthog.exception_local`. Request context is limited to the method and
path; it never includes headers, cookies, credentials, or URL query parameters.

Server exception capture is a documented temporary exception to the usual telemetry privacy boundary. The original
exception object, message, and stack are intentionally preserved in PostHog and local server logs, even though the
project has not yet defined sensitive exception content or a redaction contract. This can transmit confidential data.
Developers must therefore not add secrets, access credentials, patient data, medical free text, or raw request data to
exception messages. The exception applies only to diagnosis output, not to business-event properties. Treat any real
exposure as a telemetry privacy defect and use it to define and enforce the capture boundary.

## Privacy & Security

- Do not send medical free text, contact details, names, phone numbers, email addresses, raw messages, authentication tokens, or unnecessary location detail in business-event properties.
- Client-side analytics require PostHog analytics consent.
- Server-side business events require PostHog analytics consent and fail closed when consent cannot be resolved.
- PostHog Actions may group registry events for analysis, but they are not source-of-truth event contracts.

## Validation

```bash
pnpm tests tests/unit/posthog/
pnpm check
```


<a id="five-count-reporting-v2"></a>

## Four-count reporting V3

[ADR 040](../adrs/040-adr-four-count-clinic-dashboard-reporting.md) owns V3. The server adapter sends one consolidated Query API request with a three-second total budget, no retry, no shared cache and no stale fallback. Profile Views counts repeated events; Unique Visitors counts distinct existing consent-controlled browser `distinct_id` values within each clinic/window. No patient, inquiry or session identifier replaces browser recognition.

Verified UTC capture starts are maintained per query project and event in the reporting module's
[`config.ts`](../../src/features/clinicDashboard/reporting/config.ts). Profile Views and Unique Visitors share the
profile-view start. Unknown projects or missing starts have partial coverage. Retention and capture start must cover
each window independently; first observed activity does not establish continuous capture.

The registry defines Growth-owned `clinic_inquiry_started` and `clinic_search_result_viewed`, with required `clinic_id` and no optional custom properties. The clinic form and listing client adapters capture through the typed browser facade. The first event requires an own substantive form edit, including invalid, incomplete or later cleared input; opening, focus, scrolling, prefill or consent alone do not qualify. The second requires actual viewport visibility in the active document, once per result-view instance, without a duration or percentage threshold. Neither may contain field values, contact data, medical selections, search terms or free text.

The listing client adapter observes the rendered card articles. Positive width and height inside the visual viewport, a visible document and native browser focus are required. Browser zoom does not expand visibility to the larger layout viewport. Zero-area edge contact does not count. The accepted-clinic set belongs to the committed result query, not the pending URL. Scroll, observer, focus, visibility and consent updates recheck current geometry; rejected SDK captures do not enter the accepted set. A new committed search or results page starts a new set, while ordinary rerenders and scroll or tab returns preserve it. Unopened responses and server rendering do not capture.

For both events, the SDK `before_send` hook projects the final payload after SDK enrichment. Its only custom property is `clinic_id`. Allowed SDK properties are `token`, `distinct_id`, `$device_id`, `$session_id`, `$window_id`, `$lib`, `$lib_version` and `$process_person_profile`; top-level `event`, `uuid` and `timestamp` are retained. URL/referrer metadata, superproperties and `$set`, `$set_once` or `$unset` person updates are removed. Browser recognition and technical session transport remain inside PostHog and never enter reporting DTOs. Other event types retain their existing behavior.

`tests/unit/posthog/listing-impressions.browser.test.ts` bundles the real listing adapter, template, card, frontend CSS and installed SDK. Its opt-in native Chrome process uses an isolated temporary profile and Playwright's documented CDP `noDefaults` option, which omits forced focus emulation. It observes real tab visibility, focus, native minimization, positive pixel area, consent, committed navigation and intercepted SDK transport. The test browser disables Chrome's automation marker; production SDK bot filtering is unchanged. Run it alone on an unlocked macOS desktop with `POSTHOG_BROWSER_TEST=1` and the normal unit-test command. A locked desktop fails the prerequisite explicitly and produces no new capture evidence. The unopened-page test fetches controlled page responses at the navigation boundary. It does not verify a real Next/Payload server response or RSC prefetch, live ingestion or rollout.

`tests/unit/features/clinicDashboard/reporting/posthog-v3.test.ts` can execute the exact production-emitted query through `tests/helpers/reportingClickHouse.ts`. Set `REPORTING_CLICKHOUSE_CONTAINER` to an isolated ClickHouse 25.8 test container. Each execution creates and drops a unique synthetic database and returns the calculated rows through the source API boundary. These tests prove aggregation and boundaries, not the PostHog compiler, ingestion or deployment configuration. Default unit runs skip Docker-dependent cases; source failure tests still run.

The form-side `clinic_inquiry_started` event remains registered and captured under the same consent, readiness and
property restrictions. Opening the form alone does not capture an event. V3 does not aggregate the event or track its
reporting coverage. Historical PostHog events and external insights are unchanged.

The reporting query consumes profile-view and visible-result events. Independent profile, inquiry and
SDK features retain their own sources. Operational capture verification and external event cleanup are tracked in
[Dashboard #305](https://github.com/findmydoc-platform/clinic-dashboard/issues/305).
