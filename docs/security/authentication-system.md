# Authentication System

Supabase owns browser identity and sessions. Payload owns the current application principal and authorization data. The website runtime stores neither Supabase credentials nor a server-side browser session.

## Principals

| Principal | Payload collection | Payload Admin | Runtime behavior |
| --- | --- | --- | --- |
| Platform staff | `platformStaff` | Allowed | Existing principal required; role is read from Payload on every request. |
| Clinic staff | `clinicStaff` | Denied | Existing approved principal with a clinic assignment required. Dashboard access is a separate application concern. |
| Patient | `patients` | Denied | The strategy may idempotently ensure the patient principal after authentication. |

All three are direct Payload auth collections. Payload local passwords and Payload sessions are disabled. The shared Supabase strategy is registered once on `platformStaff`; Payload makes that strategy available across the auth collections.

## Login Boundary

The website `/admin/login` only accepts platform staff. It contains no clinic role choice or clinic redirect. Clinic staff later sign in through the separate Clinic Dashboard. Patient login, public clinic registration, invitation completion, password reset, and the generic auth callback retain their existing routes until that dashboard cutover.

## Authorization and Integrity

`app_metadata.user_type` selects only `platform`, `clinic`, or `patient`. It never grants role, clinic, or approval. Payload reads those facts from the resolved principal for every request and rejects missing, duplicate, conflicting, or ineligible staff principals.

Platform roles are `admin`, `support`, and `content-manager`; new platform principals default to `support`. Only the trusted operations path or an existing administrator can assign a platform role. Clinic access additionally requires `status: approved` and a clinic relation. Request clients cannot supply the acting principal, platform role, or clinic scope.

An identity invariant serializes writes for a non-empty Supabase user id with a PostgreSQL transaction advisory lock and checks all three auth collections. Collection-local unique constraints remain the database backstop. Staff principals are never created by login. A Supabase identity without its matching Payload principal is unauthorized.

Supabase refresh-token revocation does not invalidate already-issued access tokens immediately. A token remains usable only while it resolves to a currently eligible Payload principal; changed metadata appears only after the browser refreshes its session.

## Provisioning and Recovery

Platform staff are provisioned only through the trusted `ops` workflow and must use `@findmydoc.eu` addresses. The website never offers public first-admin bootstrap. Staff category changes require explicit reprovisioning; automatic conversion between patient, clinic, and platform principals is not permitted.

Patient provisioning remains the established ensure-on-auth flow. Staff deletion first removes the Payload principal, so a later Supabase deletion failure cannot leave an authorized principal. The trusted operations path can safely retry cleanup.

## Related References

The detailed request sequence is documented in `auth-flow-diagram.md`. The direct-collection decision is recorded in ADR 025.
