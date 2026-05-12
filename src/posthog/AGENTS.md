# PostHog Integration Rules

## Priorities

- `P0`: Keep PostHog calls safe, typed, and server/client boundary aware.
- `P1`: Use one public API surface for product code.
- `P2`: Keep telemetry helpers small and explicit.

## Critical Rules

- Product code outside `src/posthog/**` must import PostHog only through `@/posthog/api` for server code or `@/posthog/client-api` for client code.
- Do not import `posthog-node`, `posthog-js`, `@/posthog/server`, `@/posthog/client`, `@/posthog/identify`, `@/posthog/telemetry`, or `@/posthog/analytics` outside this folder.
- Every feature flag must be registered in `POSTHOG_FLAG_REGISTRY` with a code default before use.
- Server-side feature flag reads must use `evaluatePostHogFlags()` and branch on the returned snapshot.
- Event capture must pass the same snapshot that the code branched on; do not use PostHog `sendFeatureFlags`.
- Browser-side PostHog remains consent-controlled and may only use `@/posthog/client-api`.
