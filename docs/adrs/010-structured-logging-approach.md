# ADR: Structured Logging Approach

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 11.12.2025 |
| Status | approved |

## Background

The findmydoc portal currently logs through ad-hoc `console.*` calls in a mix of server-side (Payload hooks / Next.js routes) and client-side (React) code paths. This makes logs difficult to search, correlate, and safely operate in production.

The project already has relevant infrastructure in place:

- PayloadCMS uses Pino under the hood, and this repo configures Payload logging via the `logger` config option.
- This repo already controls Payload log verbosity via `PAYLOAD_LOG_LEVEL` in `src/payload.config.ts` (defaulting to `error` if unset).
- Next.js supports server startup hooks through `instrumentation.ts`.
- PostHog is available for client-side error tracking and can also be used for server-side exception capture.

This ADR is scoped to establishing a single, consistent logging approach (structured logs on the server; error tracking + minimal logs on the client) and a migration path away from scattered `console.*` usage.

## Problem Description

Unstructured console logging has the following issues:

1. Lack of structure and consistent context (user, request, operation, correlation IDs).
2. Poor production observability (hard to query/filter by fields).
3. Mixed concerns (debug, info, and error output all goes to the same unstructured channel).
4. Testing friction (logs require custom silencing and can make tests noisy).
5. Increased risk of leaking sensitive values (tokens, secrets) into logs.

## Considerations

### Evaluation Criteria

- **Leverage existing stack**: prefer built-in Payload / Next.js capabilities over introducing new logging stacks.
- **Dependency and maintenance cost**: avoid adding packages that increase configuration surface area or long-term maintenance.
- **TypeScript ergonomics**: strong typing for log context and easy usage in hooks/routes.
- **Production observability**: JSON structured logs, consistent keys, and predictable severity.
- **Performance**: low overhead in hot paths; avoid synchronous logging where possible.
- **Security and privacy**: provide a reliable strategy for redacting sensitive values (tokens, secrets).
- **Client/server boundary**: server logs must not leak into client bundles; client output should be minimal and production-safe.
- **Testing**: logs should be quiet by default in tests and easy to assert when needed.

### Updated Findings (2026 revalidation)

- Payload config supports a `logger` option that accepts Pino options or an instantiated Pino logger ([Payload config options](https://github.com/payloadcms/payload/blob/main/docs/configuration/overview.mdx)). This repo already configures Payload logger options and uses `PAYLOAD_LOG_LEVEL` for verbosity.
- Next.js `instrumentation.ts` exports a `register()` function that runs once per server instance ([Next.js instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)). PostHog’s Next.js guidance also uses this file for server-side error capture via `onRequestError` (Node runtime only).
- PostHog supports error tracking enhancements for Next.js, including source map upload through `@posthog/nextjs-config` ([PostHog Next.js sourcemaps](https://github.com/posthog/posthog.com/blob/master/contents/docs/error-tracking/upload-source-maps/nextjs.mdx)) and capture patterns using App Router error boundaries (e.g., `app/error.tsx`).
- Pino supports built-in redaction via the `redact` option ([Pino redaction](https://github.com/pinojs/pino/blob/main/docs/api.md)); prefer logger-level redaction over ad-hoc “sanitize before log” patterns when possible.

### Options Considered

1. **Use Payload’s built-in Pino logger for server logging (recommended)**
   - Pros: no new dependency, structured logs, consistent with Payload internals, best performance.
   - Cons: server-only; requires a client-side strategy and consistent access patterns.

2. **Adopt Winston**
   - Pros: flexible transport system.
   - Cons: duplicates Payload’s Pino setup and adds dependency/config surface.

3. **Add standalone Pino**
   - Pros: structured logs; familiar API.
   - Cons: duplicates the existing logger and configuration.

4. **Console wrapper + PostHog**
   - Pros: works everywhere.
   - Cons: console remains synchronous/unstructured; worse production queryability.

5. **Use `debug` for development and PostHog for production errors**
   - Pros: great DX for dev.
   - Cons: not a production logging strategy; no structured logs.

### Comparison Matrix

| Option | New deps | Structured logs (server) | Structured logs (client) | Perf | TypeScript DX | Prod-ready | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Payload Pino (recommended) | No | Yes | No | High | High | Yes | Reuses Payload logger already configured in this repo. |
| Winston | Yes | Yes | Possible | Medium | Medium | Yes | Duplicates Payload/Pino configuration and adds maintenance surface. |
| Standalone Pino | Yes | Yes | Possible | High | High | Yes | Duplicates Payload’s logger unless carefully coordinated. |
| Console wrapper + PostHog | No | No | Limited | Low | High | Mixed | Console is synchronous and hard to query in production. |
| `debug` + PostHog | Yes | No | No | High | Medium | No | Useful for development namespaces; not a production logging solution. |

## Decision with Rationale

### Decision

Adopt a hybrid approach:

- **Server-side**: standardize on Payload’s built-in Pino logger (via Payload instance) for all server logs.
- **Client-side**: treat PostHog error tracking as the primary production signal; keep client “logging” minimal and development-only.

### Rationale

- Minimizes dependencies and leverages existing platform capabilities.
- Keeps Payload as the source of truth and uses the same logger for application code and Payload internals.
- Aligns with Next.js and PostHog guidance: use error boundaries for render errors and supported hooks (`instrumentation.ts`) for server-side error capture if needed.
- Enables first-class redaction using Pino’s `redact` feature, reducing the risk of leaking secrets.

### Implementation Sketch (non-normative)

Server-side (Payload hooks, Next.js route handlers, Server Components):

```ts
import { getPayload } from 'payload'
import config from '@payload-config'

export async function getServerLogger() {
  const payload = await getPayload({ config })
  return payload.logger
}
```

Client-side (App Router):

- Use Next.js error boundaries (`app/error.tsx`, optionally `app/global-error.tsx`) to capture and report errors to PostHog.
- Use `@posthog/nextjs-config` for sourcemap upload to improve stack traces.

## Technical Debt

- Migrate existing `console.*` usage to the agreed logger APIs (prioritize auth flows and critical endpoints).
- Define a small, shared logging utility surface (server helper for `payload.logger`, client helper for “dev log + PostHog error capture”).
- Standardize redaction (prefer Pino `redact` at the logger level) and document “never log” fields.
- Update test utilities so logs are quiet by default but can be enabled for debugging.
- Add linting guardrails (e.g., discourage `console.*` outside approved utilities).

## Risks (Optional)

- **Edge runtime incompatibility**: server logging utilities must not be imported into Edge-only code paths.
- **Sensitive data leakage**: without logger-level redaction, developers may accidentally log secrets.
- **Log volume/cost**: excessive `info` logging in production can become noisy/expensive; default to `error` unless there is a clear need.
- **Correlation gaps**: without request-level IDs (and consistent propagation), cross-request debugging remains difficult.

## Deprecated (Optional)

None.

## Superseded by (Optional)

None.
