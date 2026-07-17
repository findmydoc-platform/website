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

> **Temporary runtime notice:** The website does not yet expose the Dashboard bootstrap and capability
> contracts described here. This notice must be removed when those runtime contracts are deployed.

This document records the approved server-to-server integration contract for the standalone Clinic Dashboard. It is
durable architecture documentation, not an execution plan. The contract does not add browser access to Payload,
Payload CORS origins, a Dashboard database, service-role credentials, public cache behavior, or clinic login UI to the
website.

## Boundary and Ownership

| Concern | Website and Payload | Clinic Dashboard |
| --- | --- | --- |
| Identity validation | Validate the Supabase access token against the matching environment. | Complete PKCE, store and refresh the user session in host-bound `HttpOnly` cookies. |
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

`ClinicDashboardCapability` is a closed, version-controlled string union. It describes user-visible operations, not
Payload collection names or field-level access details. New capability values require synchronized type, endpoint,
Dashboard behavior, and permission tests.

The DTO deliberately omits Supabase identifiers, tokens, internal roles, access-control metadata, Payload timestamps,
and unrelated clinic fields. Later capability endpoints may add their own DTOs without expanding this bootstrap into a
generic data endpoint.

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

All state-changing Dashboard routes use one shared mutation guard rather than route-local CSRF implementations. The
guard validates the session and exact origin, then verifies a stateless HMAC-signed CSRF token bound to the current
Supabase session. Staging and Production use a host-only `__Host-` CSRF cookie. This protection belongs entirely to the
Dashboard BFF and requires no Payload change.

## Error Mapping

| Payload or upstream condition | Dashboard BFF result | Session effect |
| --- | --- | --- |
| Missing or invalid Supabase access token | `401 Unauthorized` | Dashboard may attempt one controlled refresh; persistent failure clears invalid cookies. |
| Valid identity without a matching clinic principal | `401 Unauthorized` | Fail closed; do not create staff during authentication. |
| Principal not approved, missing clinic, or forbidden capability | `403 Forbidden` | Preserve the session so the Dashboard can render an access-state explanation. |
| Invalid request input | `400 Bad Request` with a stable error code | Preserve the session. |
| Conflict with current business state | `409 Conflict` with a stable error code | Preserve the session and allow a controlled refresh. |
| Payload unavailable or timed out | `502 Bad Gateway` or `504 Gateway Timeout` | Preserve the session; do not present an upstream outage as logout. |

Error bodies expose stable machine-readable codes and safe user-facing categories. They do not expose tokens, raw
Payload errors, SQL details, stack traces, clinic data from a denied request, or Supabase response bodies.

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
