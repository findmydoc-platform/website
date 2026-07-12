# Monitoring and Error Logic

This document defines the operational monitoring map for the `findmydoc` portal. It covers what the team watches, where signals are available, how to read them, who reacts, and which privacy boundaries apply.

For logger implementation details, see [Logging](./logging.md) and [ADR 010](./adrs/010-structured-logging-approach.md). For PostHog event governance, see [PostHog Integration](./integrations/posthog.md) and [ADR 019](./adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md).

## Operating Model

Production monitoring uses three signal groups:

1. **Runtime and request logs**
   Preview and production deployments emit structured JSON logs to `stdout` and `stderr`. Vercel ingests those logs and exposes them through the Vercel dashboard and CLI. Server-side application logs use Payload's Pino logger or scoped wrappers around it.
2. **PostHog error tracking and product telemetry**
   Next.js request errors are forwarded through `src/instrumentation.ts` into PostHog error tracking when PostHog is configured. Product telemetry remains consent-controlled and governed by the event registry; it is not the escalation source for operational incidents.
3. **Deployment and migration signals**
   GitHub Actions and Vercel deployment logs show build, migration, deploy, and aliasing failures. These signals belong to release operations, not product analytics.

As of the implementation check for this document, the connected PostHog project has error tracking data and no configured `system.logs_alerts` entries. No dashboard matched the search terms `monitoring`, `error`, or `reliability`. Structured visibility exists, but active reliability dashboards and log alerts are a separate follow-up, not part of this documentation change.

## Reading Production Logs

Use the Vercel project `findmydoc-portal` under the `findmydoc` scope.

```bash
vercel logs --project findmydoc-portal --scope findmydoc --environment production --since 1h --level error --json --limit 100
```

For known application events, search by the stable event string:

```bash
vercel logs --project findmydoc-portal --scope findmydoc --environment production --since 1h --query "api.formBridge.submit.failed" --json --limit 100
vercel logs --project findmydoc-portal --scope findmydoc --environment production --since 1h --query "auth.supabase.authenticate.failed" --json --limit 100
vercel logs --project findmydoc-portal --scope findmydoc --environment production --since 1h --query "storage.media.upload_failed" --json --limit 100
```

For deploy and migration failures, inspect the matching GitHub Actions run first and then the related Vercel deployment logs:

```bash
gh run list --repo findmydoc-platform/website --branch main --limit 10
vercel ls findmydoc-portal --scope findmydoc
vercel inspect <deployment-url-or-id> --scope findmydoc --logs
```

## Critical Monitoring Flows

| Flow | Primary signals | Where to inspect | Risk | First response | Escalation | Privacy boundary |
| --- | --- | --- | --- | --- | --- | --- |
| Public marketing and contact forms | `api.formBridge.submit.failed`; PostHog `patient_inquiry_created` and `clinic_onboarding_interest_created` when consent allows capture | Vercel runtime logs; Payload form submissions; PostHog only for governed aggregate analysis | P1 when accepted submissions fail or users cannot submit; P2 when only analytics capture fails | Check Vercel error logs for the event string, confirm whether Payload submissions were persisted, and verify whether user-facing responses returned 4xx or 5xx | Technical owner leads triage; business-risk reader receives context when lead capture may be affected | Do not log or copy names, emails, phone numbers, raw messages, preferred appointment details, medical free text, request bodies, cookies, or headers |
| Auth and Supabase | `auth.supabase.*`, `auth.admin_login.*`, password reset and registration route events | Vercel runtime logs; Supabase operational view when needed; GitHub/Vercel deploy logs for configuration regressions | P1 for login, registration, password reset, platform admin access, or provisioning failures; P2 for isolated rejected requests with expected generic user response | Filter `auth.supabase.*`, check route-specific event names, and verify whether failures are expected denials or system errors | Technical owner leads triage; business-risk reader is informed when admin or user onboarding risk is material; consulted RACI roles are added only when their area is affected | Hash email-derived identifiers. Do not expose passwords, tokens, Supabase service role keys, cookies, auth sessions, raw emails, or raw user profiles |
| Storage and media uploads | `storage.media.upload_failed`, `storage.media.upload_recovery_needed`, `storage.media.path_resolution_failed` | Vercel runtime logs; Payload media collection state; object storage provider only when the app receives enough context | P1 when public or admin media workflows are blocked; P2 when a seed/media recovery path is expected and contained | Filter storage events, confirm collection and storage prefix, and distinguish app-level failures from Vercel request-size rejection | Technical owner leads triage; affected content or operations owners are consulted based on the collection involved | Do not copy raw files, private media, signed URLs, storage credentials, request bodies, or unrelated CMS field payloads |
| Runtime and request errors | Next.js `onRequestError`; PostHog `exception`; Vercel 5xx/runtime logs | PostHog error tracking; Vercel runtime logs; deployment logs when errors start after release | P1 for repeated 5xx, admin route failures, form route failures, or production-only regressions; P2 for isolated non-critical exceptions | Check Vercel error logs for the time window, then inspect the grouped PostHog error record without copying raw user data into docs or tickets | Technical owner leads triage; business-risk reader receives operational-risk summary for visible production impact | Do not expose raw stack traces containing secrets, request headers, cookies, auth data, URL query strings with sensitive values, or private route payloads |
| Deployments and migrations | GitHub Actions failure, Vercel deploy failure, Payload migration failure, alias failure | GitHub Actions run logs; Vercel inspect logs; deployment runbook | P1 when production deploy, migration, or aliasing is blocked; P2 for preview-only deploy failures without user impact | Inspect the failed run, identify whether failure is build, migration, environment, or aliasing, and avoid manual production schema repair | Release owner leads triage; business-risk reader is informed when release timing or production availability is affected | Do not paste secrets, Vercel tokens, database URLs, migration data dumps, or private deployment environment values into tickets or docs |
| Public discovery monitoring | `public_discovery.crawler.requested`; `pnpm discovery:health` results; sitemap and robots route status | Vercel runtime logs; local or production discovery health check; public discovery docs | P2 for crawler/discovery drift; P1 only when production indexing behavior is actively broken | Filter crawler events, run discovery health, and check whether sitemap/robots/llms endpoints return expected public responses | Technical owner leads triage; SEO/content stakeholders are consulted only when indexability or public visibility is affected | Logs must not include cookies, auth data, contact details, medical free text, private content, draft content, admin-only content, IP-based profiles, or individual identities |

## Escalation Rules

The technical owner is accountable and responsible for this monitoring topic and for the first technical triage path. The business-risk reader is informed when an incident can affect lead capture, onboarding, public trust, admin access, or production availability.

Use the broader RACI roles as consulted or informed only when their area is affected. Do not infer hidden technical ownership from planning metadata.

Escalate immediately when one of these conditions is true:

- public form submissions fail or appear to be accepted without being persisted
- production returns repeated 5xx responses on public, auth, or admin routes
- login, registration, password reset, or platform admin access is materially blocked
- production deploy, migration, or aliasing fails
- logs suggest accidental exposure of personal data, secrets, auth state, or medical free text

Keep routine warnings inside technical triage unless the same event repeats, affects a primary flow, or creates trust, privacy, or revenue risk.

## Privacy And Logging Boundaries

Logs and monitoring notes must use the minimum data needed to debug the operational signal.

Never log or copy these values into tickets, Notion pages, PR descriptions, screenshots, or external artifacts:

- passwords, tokens, cookies, secret keys, service role keys, authorization headers, database URLs, or webhook secrets
- patient or contact names, email addresses, phone numbers, raw inquiry messages, appointment notes, medical details, or free text
- raw request bodies, raw headers, auth sessions, private route data, draft content, preview-only content, or full Payload documents
- private machine-specific network addresses, account-local routes, or private remote-access hostnames

Use stable event names, hashed identifiers, collection names, route paths, deployment environment, request IDs, and Vercel IDs instead. If a raw value is required for a controlled local-only debugging session, do not promote it into repository files, Notion, tickets, PRs, or shared screenshots.

## Known Gaps And Follow-Up

Structured logs and PostHog error tracking are available, but the reliability operating surface is still mostly manual:

- no confirmed PostHog log alerts are configured
- no confirmed PostHog dashboard is dedicated to production reliability
- no escalation automation is documented for repeated P1 events

If active monitoring is required, open a separate website follow-up for a reliability dashboard and alerting setup. That follow-up should define alert thresholds, notification channels, ownership, data-retention expectations, and privacy review before any alert or dashboard is created.
