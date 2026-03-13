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
- `api.forms.submit.failed`

## Reading Logs on Vercel

Preview and production deployments emit JSON logs to `stdout`/`stderr`, which Vercel ingests automatically.

Recommended filters:

- `event:auth.supabase.authenticate.failed`
- `event:auth.supabase.admin.client_init_failed`
- `event:storage.media.upload_failed`

If an upload is rejected by Vercel before the app receives the request, Payload cannot log that failure. Those cases must be diagnosed from Vercel request/runtime logs instead of application logs.

## Local Development

Local `development` uses pretty logging for readability.

Recommended workflow:

1. Start with `pnpm dev` (development uses pretty output automatically).
2. Keep event names stable so local traces match Vercel logs.

## Guardrails

ESLint blocks direct `console.*` usage in server-side auth, hooks, route handlers, collections, endpoints, instrumentation, and PostHog server files. Allowed exceptions are limited to client-only files and the logging fallback utility itself.
