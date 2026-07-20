# Authentication System

Supabase owns identity and user sessions. Payload owns the current application principal and authorization data. Each
application surface establishes its own session boundary and then relies on Payload for current business authorization.

## Principals

| Principal | Payload collection | Payload Admin | Runtime behavior |
| --- | --- | --- | --- |
| Platform staff | `platformStaff` | Allowed | Existing principal required; role is read from Payload on every request. |
| Clinic staff | `clinicStaff` | Denied | Existing approved and synchronized principal assigned to an approved, non-deleted clinic. Dashboard requests arrive through the Dashboard BFF. |
| Patient | `patients` | Denied | The strategy may idempotently ensure the patient principal after authentication. |

All three are direct Payload auth collections. Payload local passwords and Payload sessions are disabled. The shared Supabase strategy is registered once on `platformStaff`; Payload makes that strategy available across the auth collections.

## Application Surfaces

| Surface | Login and session boundary | Payload access |
| --- | --- | --- |
| Payload Admin | The website `/admin/login` accepts platform staff only. | Payload Admin uses the resolved `platformStaff` principal and current role. |
| Patient portal | The website owns patient login, public clinic registration, patient invitation completion, password reset, callback, and logout routes. | Website-owned API paths authenticate the current patient principal. |
| Clinic Dashboard | The standalone Dashboard owns login, PKCE callback, refresh, and logout in secure, host-bound, `HttpOnly` cookies. The portal may link to it but transfers no session. | Browser application code calls only the Dashboard origin. The Dashboard BFF sends the current access token to Payload server-side. |

The website contains no clinic role choice, clinic login form, or clinic access to Payload Admin. Server-generated
clinic invitation and password-reset links target the Clinic Dashboard origin configured through
`CLINIC_DASHBOARD_URL`; the website does not expose that value to browser code.

## Clinic Dashboard BFF Boundary

The Clinic Dashboard is a stateless Next.js application without a database. React Server Components use a server-only
Payload client directly. Browser-initiated application reads and mutations use capability-specific Route Handlers on
the Dashboard origin. Those routes validate session, input, origin, and CSRF before calling Payload. There is no generic
Payload proxy and no browser-to-Payload data path.

Dashboard browser code receives neither Supabase access nor refresh tokens and does not create a Supabase browser
client. The Dashboard uses only a publishable key. Payload CORS does not include Dashboard origins because all Payload
requests are server-to-server.

## Authorization and Integrity

`app_metadata.user_type` selects only `platform`, `clinic`, or `patient`. It never grants role, clinic, or approval. Payload reads those facts from the resolved principal for every request and rejects missing, duplicate, conflicting, or ineligible staff principals.

Platform roles are `admin`, `support`, and `content-manager`; new platform principals default to `support`. Only the trusted operations path or an existing administrator can assign a platform role. Clinic access additionally requires staff `status: approved`, staff `authSync.status: synced`, a clinic relation, and a clinic that is approved and not deleted. Request clients cannot supply the acting principal, platform role, or clinic scope.

An identity invariant checks all three auth collections through the Payload Local API for every non-empty Supabase user id. Collection-local unique constraints remain the final backstop inside each collection. Staff principals are never created by login. A Supabase identity without its matching Payload principal is unauthorized.

Supabase refresh-token revocation does not invalidate already-issued access tokens immediately. A token remains usable only while it resolves to a currently eligible Payload principal; changed metadata appears only after the browser refreshes its session.

## Provisioning and Recovery

Platform staff are provisioned only through the trusted `ops` workflow and must use `@findmydoc.eu` addresses. The website never offers public first-admin bootstrap. Staff category changes require explicit reprovisioning; automatic conversion between patient, clinic, and platform principals is not permitted.

Approving a clinic application currently creates a pending clinic and a pending initial clinic staff principal and sends
the staff invitation to the Dashboard. The resulting Supabase account is prepared but not authorized for business
access. Platform staff separately complete and approve the clinic and approve the staff principal. This application
trigger is a temporary simulation of a future CRM decision; the reusable provisioning service accepts a stable
onboarding command so a CRM can replace the application collection later.

Clinic staff transitions are enforced server-side. Rejected and disabled identities are banned in Supabase, approved
and reactivated identities are unbanned, and offboarded identities are deleted from Supabase while the Payload row is
retained. Synchronization failures remain visible and retryable without granting access.

Password-reset routing is resolved from current Payload principals. An eligible pending or approved clinic principal
with a synchronized identity receives a Dashboard callback. Blocked, duplicate, unsynchronized, or cross-principal
email matches receive the same neutral API response without sending a reset. Patient, platform-staff, and unknown-email
requests retain the website callback and its existing enumeration-resistant response.

Patient provisioning remains the established ensure-on-auth flow. Staff deletion first removes the Payload principal, so a later Supabase deletion failure cannot leave an authorized principal. The trusted operations path can safely retry cleanup.

## Related References

The detailed request sequences are documented in `auth-flow-diagram.md`. ADR 025 records the direct principal
collections. ADR 026 records the standalone Clinic Dashboard BFF, session, callback, API, error, and cache boundaries.
