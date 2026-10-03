# Supabase Provisioning

Supabase creates and manages external identities. Payload stores the direct application principals and remains the authorization source.

## Staff Provisioning

The trusted operations workflow creates, repairs, and deletes platform staff. It first verifies that the Supabase id is not assigned to a patient or clinic staff principal, ensures Supabase metadata identifies the account as `platform`, then creates or updates the matching `platformStaff` document. New platform staff default to `support`; an elevated role is always explicit.

An approved `clinicApplications` record authorizes Dashboard participation for the resulting clinic and its named
initial `clinicStaff` principal. The reusable provisioning service creates the clinic with `status: pending` and
`participationStatus: approved`, and the initial staff member with `status: approved`. Public publication remains the
separate completeness and quality decision on `clinics.status`. Additional staff retain their existing manual lifecycle.

The application stores resulting IDs in `linkedRecords`. The clinic has no `sourceApplication` relationship; a CRM
can replace the application trigger with the same stable onboarding command. New participants carry a private unique
`provisioningIdentity` derived from that command. Retries first resolve the existing onboarding key and refuse ambiguous,
rejected, deleted, disabled, offboarded, reassigned, or changed-email participants. Historical failed or waiting records
are not promoted automatically.

The existing native invitation path remains active. The service records its first attempt before dispatch. Later retries
only reconcile the intended existing identity; they do not authorize another invitation. The provider's server-controlled
`app_metadata.onboarding_key` binds recovery to the source. User-editable metadata cannot establish ownership. An uncertain
response without this binding requires operator repair. An existing identity is checked before invitation dispatch,
including recovery after a request rollback. Business approval remains recorded when provider or binding preparation fails.

Usable access additionally requires synchronized identity and private password evidence bound to the current staff
subject and clinic. Delivery and invitation acceptance do not establish that evidence. The
[clinic participation contract](clinic-participation.md) defines completion, the bounded legacy transition, and the
Website-owned integration boundary. Authentication never creates staff or grants additional participants.

## Clinic Staff Lifecycle

Payload is the lifecycle authority for clinic staff:

- `pending` can become `approved`, `rejected`, or `offboarded`;
- `approved` can become `disabled` or `offboarded`;
- `disabled` can become `approved` or `offboarded`;
- `rejected` can become `offboarded`;
- `offboarded` is terminal.

Approving or reactivating staff unbans the Supabase identity. Rejecting or disabling staff bans it. Offboarding
permanently deletes the Supabase identity while retaining the offboarded Payload row as the business record. Invalid
transitions are rejected server-side.

## Patient Provisioning

Patients retain ensure-on-auth. After Supabase confirms the browser identity, the strategy may create or update the matching `patients` principal idempotently. Patient creation does not create staff records or alter a staff classification.

## Failure Behavior

Clinic application provisioning records `not_started`, `failed`, or `completed` with a stable failure category.
Partial records retain their onboarding key. A changed provisioning input on a failed approved application retries
preparation against the same records. A changed contact email cannot replace the approved initial participant through
this technical retry. A new invitation or identity repair requires the owning trusted workflow.

Clinic staff auth synchronization records `pending`, `synced`, `failed`, or `deleted`. Saving a failed non-terminal
lifecycle state retries the same Supabase operation. Authorization fails closed whenever Supabase and Payload do not
resolve to the same eligible principal. No runtime path promises immediate invalidation of an already-issued Supabase
access token.

The operations workflow still owns platform-staff production writes. Clinic staff creation and lifecycle synchronization
are owned by the clinic onboarding service and Payload lifecycle hooks.
