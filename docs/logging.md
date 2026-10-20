# Logging

This document is the operational guide for server-side logging in the `findmydoc` portal.

For the architecture decision and rationale, see [ADR 010](./adrs/010-structured-logging-approach.md).

## Environment Behavior

Payload logging is configured in [src/payload.config.ts](../src/payload.config.ts) via [src/utilities/logging/payloadLogger.ts](../src/utilities/logging/payloadLogger.ts).

| Environment | Output format | Default level |
| --- | --- | --- |
| `development` | Pretty console output | `warn` |
| `preview` | JSON | `info` |
| `production` | JSON | `warn` |
| `test` | JSON | `error` |
| anything else | JSON | `warn` |

## Which Logger to Use

Use the narrowest logger entry point that already has the right context.

- Prefer `payload.logger` or `req.payload.logger` inside Payload hooks, collections, and request handlers that already have a Payload context.
- Use [src/auth/utilities/supabaseLogger.ts](../src/auth/utilities/supabaseLogger.ts) for auth and Supabase flows that do not already receive `payload.logger`.
- Use `getServerLogger()` only at server boundaries without a Payload context.
- Use `fallbackConsoleLogger` only for bootstrap or telemetry boundaries where Payload initialization may not be available or desirable.

## Supabase Helpers

[src/auth/utilities/supabaseLogger.ts](../src/auth/utilities/supabaseLogger.ts) is the standard entry point for auth-related logging.

- `getSupabaseLogger(...)`
  Returns a scoped logger with `scope: "auth.supabase"` and request metadata.
- `getLoggedSupabaseAdminClient(...)`
  Wraps `createAdminClient()` and logs `auth.supabase.admin.client_init_failed` before rethrowing bootstrap failures.

Use `getLoggedSupabaseAdminClient(...)` whenever the code path depends on the Supabase admin client and missing env/config should be observable.

## Event and Field Conventions

Every server log should include an `event` field.

Common fields:

- `scope`
- `deploymentEnv`
- `method`
- `path`
- `requestId`
- `vercelId`
- `operation`
- `collection`
- `userId`
- `supabaseUserId`
- `storagePrefix`
- `fileName`
- `fileSize`

Errors should be logged as `err`, not as preformatted strings.

## Sensitive Data Rules

Never log raw values for:

- passwords
- tokens
- cookies
- secret keys
- service role keys
- authorization headers
- raw email addresses unless explicitly required for a controlled local-only debugging session

Use `hashLogValue(...)` for stable identifiers derived from user input such as email addresses.

Logger-level redaction is configured centrally in [src/utilities/logging/payloadLogger.ts](../src/utilities/logging/payloadLogger.ts).

## Important Event Families

- `auth.supabase.*`
- `storage.media.upload_failed`
- `telemetry.posthog.*`
- `api.formBridge.submit.failed`
- `database.runtime.connection_unavailable`

## Reading Logs on Vercel

Preview and production deployments emit JSON logs to `stdout`/`stderr`, which Vercel ingests automatically.

Recommended filters:

- `event:auth.supabase.authenticate.failed`
- `event:auth.supabase.admin.client_init_failed`
- `event:storage.media.upload_failed`
- `event:api.formBridge.submit.failed`
- `event:database.runtime.connection_unavailable`

If an upload is rejected by Vercel before the app receives the request, Payload cannot log that failure. Those cases must be diagnosed from Vercel request/runtime logs instead of application logs.

Database availability events include only a sanitized error plus `databaseFailureKind`, `databaseMode`, and `phase`.
They must never include the original database message or connection URL. See
[Database Runtime Connections](./engineering/database-runtime-connections.md) for the HTTP and telemetry contract.

For the flow-level operating map, escalation rules, and privacy boundaries, see [Monitoring and Error Logic](./monitoring-and-error-logic.md).

## Post publication schedules

Filter runtime logs by `scope:posts.scheduling` or `event:posts.scheduling.created`, then follow
`postId` and `jobId` across requests. Both publish and unpublish use the same events; `action`
distinguishes them. `Published At` alone creates no schedule and produces no scheduling event.

| Event suffix | Meaning |
| --- | --- |
| `created` | Native queue storage succeeded. |
| `creation_failed` | Native schedule creation or its Admin request failed. |
| `cancelled` | A pending job was removed; `reason` is `explicit` or `post_deleted`. |
| `cancellation_failed` | An Admin cancellation failed, or a pending job remained after Post deletion. |
| `attempt_started` | The native task handler began a publication attempt. |
| `attempt_succeeded` | The native publication handler returned successfully after its status update. |
| `attempt_failed` | The native handler threw or returned a failed state. |
| `observation_failed` | A diagnostic read failed; cancellation history may be incomplete. |

Events include the scheduled UTC instant, validated IANA timezone when stored, locale scope,
initiating staff `userId` when stored, request actor `actorId` when known, environment and
`eventTime`. Request and Vercel correlation identifiers are included when available, including
Admin requests that fail before allocating a job. Each execution includes `attempt`, calculated
from the native job's prior attempt count. Errors contain only an allowlisted class and numeric
status, without raw messages, stack traces, article content or credentials.
If native retry handling changes `waitUntil`, execution events show that attempt's scheduled
instant. Use the `created` event with the same `jobId` for the original publication schedule.

The scoped child of the existing Payload logger uses `info`, so successful lifecycle events pass
the Production root logger's `warn` threshold without changing global verbosity or redaction.
Failures use `error`. Native queueing, publication, retries and cleanup remain unchanged.
Successful-job cleanup is not a cancellation. Post deletion is reported only when a pending job
captured before native deletion is confirmed absent afterward; moving a Post to Trash alone is
not reported as cancellation when native Payload leaves its schedule intact.
Diagnostic reads use an independent request without the deletion transaction or its data loader.
Cancellation confirmation runs after the existing native DELETE endpoint or Local API returns.
For bulk deletion, only documents in the native successful result can produce cancellation events.
Caller-owned transactions produce `observation_failed` with `reason:caller_transaction_pending`
instead of cancellation confirmation, because the caller can still roll back afterward.

These are runtime diagnostics within the existing Vercel retention period, not a permanent audit
trail. Process termination, failed diagnostic reads, delivery loss, transaction rollback and expired
retention can leave gaps. A start without an outcome can indicate interruption. A missing event
does not prove that a schedule or attempt never existed. Handler success records the native
publication outcome, not a guarantee that later job bookkeeping or log delivery succeeded.
Cancellation events cover the native Admin scheduling request and collection deletion hooks.
Generic programmatic Jobs `cancel` and `cancelByID` calls do not pass through these editorial hooks.

## Local Development

Local `development` uses pretty logging for readability.

Recommended workflow:

1. Start with `pnpm dev` (development uses pretty output automatically).
2. Keep event names stable so local traces match Vercel logs.

## Guardrails

ESLint blocks direct `console.*` usage in server-side auth, hooks, route handlers, collections, endpoints, instrumentation, and PostHog server files. Allowed exceptions are limited to client-only files and the logging fallback utility itself.
