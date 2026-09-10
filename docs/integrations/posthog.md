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
```

> **Note:** The project targets the EU host (`https://eu.i.posthog.com`); keep that consistent in documentation and deployments.
> **Security:** `POSTHOG_FEATURE_FLAGS_SECURE_API_KEY` is a server-side secret for local feature flag evaluation. Store it in Vercel environment variables or a secrets manager, not in PayloadCMS.

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
| `clinic_profile_viewed`              | Consent-eligible public clinic profile view in the browser       | `clinic_id`, `clinic_slug`, `page_path`, `source_route`                                        | `has_doctors`, `has_treatments`, `verification_tier`                                                                                   | Clinic metadata only. No visitor contact details or medical data.                                | Clinic profile reach and entry-volume analysis.                   |
| `clinic_cta_clicked`                 | Consent-eligible tracked clinic profile CTA click in the browser | `clinic_id`, `clinic_slug`, `cta_id`, `cta_label`, `cta_location`, `page_path`, `source_route` | `doctor_id`, `treatment_id`                                                                                                            | No contact details, medical free text, or raw message content.                                   | Clinic profile CTA engagement and contact-intent funnels.         |
| `patient_inquiry_created`            | Clinic profile contact form accepted by the form bridge          | `clinic_id`, `clinic_slug`, `form_slug`, `source_route`                                        | `doctor_id`, `has_doctor`, `has_message`, `has_preferred_date`, `has_preferred_time`, `has_treatment`, `submission_id`, `treatment_id` | No patient name, email, phone, appointment date/time, medical free text, or raw message content. | Clinic profile inquiry conversion analysis.                       |
| `clinic_onboarding_interest_created` | Clinic partner contact form accepted by the form bridge          | `form_slug`, `page_path`, `source_route`                                                       | `has_message`, `submission_id`                                                                                                         | No contact details or submitted message content.                                                 | Clinic partner landing conversion analysis.                       |
| `register_clinic_submitted`          | Clinic registration application created or deduplicated          | `source_route`, `submission_status`                                                            | `country`, `has_additional_notes`, `has_contact_phone`                                                                                 | No clinic contact person, email, phone, street address, or additional notes content.             | Clinic registration submission and duplicate-submission analysis. |

Server-side business event capture is gated by PostHog analytics consent. Operational submissions still complete when
analytics consent is absent; only PostHog event capture is skipped.

### Operational Guard Flags

The current repository registers exactly two server-side PostHog guard flags:

- `temporary-landing-mode`: controls the temporary public holding page.
- `preview-guard-enabled`: controls preview access protection.

These are operational access guards, not product rollout flags. They are evaluated server-side through `evaluatePostHogFlags()` and default to `false` in code when PostHog is unavailable or the secure key is missing. Guard checks use a server-side site actor with `feature_flag_site_host` and `feature_flag_site_path`; browser-side feature-flag evaluation is disabled.

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
