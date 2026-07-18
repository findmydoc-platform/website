# Clinic Dashboard Application and API Implementation Plan

> **Canonical decision:**
> [ADR 026](../../adrs/026-adr-standalone-clinic-dashboard-bff-architecture.md)
>
> **Durable website contract:**
> [Clinic Dashboard application and API architecture](../../integrations/clinic-dashboard-api.md)
>
> **Paired Dashboard plan:**
> [Clinic Dashboard authentication and BFF integration](https://github.com/findmydoc-platform/clinic-dashboard/blob/main/docs/plans/clinic-dashboard-auth-and-bff-integration.md)
>
> **Paired Dashboard contract:**
> [Clinic Dashboard authentication and BFF architecture](https://github.com/findmydoc-platform/clinic-dashboard/blob/main/docs/authentication-and-bff.md)

## Status and Scope

Status: initial Payload bootstrap implemented; Dashboard BFF integration and later capability contracts planned. This
roadmap document owns implementation order and acceptance evidence only. Durable API, security, environment, DTO,
error, and cache contracts live in the paired architecture documents and must not be redefined here.

The website work exposes the focused Payload contracts required by the standalone Clinic Dashboard. It does not add
browser access to Payload, Dashboard CORS origins, a Dashboard database, service-role credentials, public cache
behavior, or clinic login UI to the website.

## Implementation Order

1. **Implemented:** Contract tests cover explicit clinic Bearer authentication, principal resolution, approval, clinic
   assignment, tenant derivation, private response headers, upstream failure classification, and denied states.
2. **Implemented:** Payload exposes `GET /api/clinic-dashboard/bootstrap` without changing Payload CORS. Its initial
   projection contains only `clinic-profile:view` and `clinic-profile:edit`.
3. **Implemented:** The bootstrap returns a purpose-limited DTO and stable error codes without raw principals, clinic
   documents, Supabase identifiers, tokens, roles, or timestamps.
4. Coordinate the Dashboard server-only client and same-origin routes against the exact website contract and DTO
   contract.
5. Validate local and trusted preview authentication against Staging before activating the exact production callback.
6. Add later capability endpoints one bounded user operation at a time.

## Coordination Rules

- Update both durable architecture documents whenever a shared route, DTO, error, environment, or security contract
  changes.
- Keep implementation sequencing and temporary branch coordination in the two plan documents.
- Do not infer a cross-repository contract from runtime code, prototype controls, or work-tracking text alone.
- The Website owns Payload authentication, authorization, business endpoints, and DTOs. The Dashboard owns its BFF,
  session cookies, same-origin Route Handlers, React Server Component data layer, and user-facing error states.

## Acceptance Evidence

- Payload resolves clinic, status, and capabilities from the current principal for every request.
- Bootstrap and capability DTOs contain no unapproved internal fields.
- The initial capability projection contains exactly `clinic-profile:view` and `clinic-profile:edit`; later values wait
  for their own data and permission contracts.
- Invalid, missing, conflicting, and ineligible principals fail closed with the documented status mapping.
- The Payload API remains inaccessible from the Dashboard browser and requires no Dashboard CORS origin.
- Local, preview, and production configurations reject cross-environment combinations.
- Authenticated responses bypass shared and durable caches.
- Public-impacting Payload mutations retain the established public revalidation contract.

Cache impact for this documentation and implementation plan: `no-public-impact`.
