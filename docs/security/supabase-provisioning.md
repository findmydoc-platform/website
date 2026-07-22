# Supabase Provisioning

Supabase creates and manages external identities. Payload stores the direct application principals and remains the authorization source.

## Staff Provisioning

The trusted operations workflow creates, repairs, and deletes platform staff. It first verifies that the Supabase id is not assigned to a patient or clinic staff principal, ensures Supabase metadata identifies the account as `platform`, then creates or updates the matching `platformStaff` document. New platform staff default to `support`; an elevated role is always explicit.

Clinic onboarding currently uses an approved `clinicApplications` record as its trigger. The trigger passes a stable
onboarding key and the application data to a reusable provisioning service. Each execution creates a pending `clinics`
record and a pending initial `clinicStaff` principal, sends the invitation to the configured Clinic Dashboard origin,
and stores the Supabase user id on the staff principal. Login never creates clinic staff.

The application remains a review and audit record; the resulting clinic and staff ids are stored on its
`linkedRecords` group. The clinic does not keep a `sourceApplication` relationship. This keeps the materialization
service independent from the temporary application collection so a later CRM adapter can call the same service and
fully replace `clinicApplications` without changing the resulting clinic or staff model.

The initial staff account exists in Supabase after a successful invitation, but it is only prepared for onboarding.
Business access remains denied until the staff principal is `approved`, its `authSync.status` is `synced`, and its
assigned clinic is approved and not deleted.

All staff writes use the shared identity invariant, which checks all auth collections through the Payload Local API before committing. Clinic onboarding does not lock or deduplicate its onboarding key. After creating records, it queries Payload for the same key and logs a structured warning with the affected ids when duplicates exist.

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

Clinic application provisioning records `not_started`, `failed`, or `completed` and exposes only a stable failure
category. Partial clinic and staff records are retained after a failure. Saving the failed approved application starts
another provisioning attempt with the same onboarding key and may create additional records. Those records remain
traceable through the shared key and the duplicate warning log. Unknown invite responses are reconciled by normalized
email and onboarding key before another identity is accepted.

Clinic staff auth synchronization records `pending`, `synced`, `failed`, or `deleted`. Saving a failed non-terminal
lifecycle state retries the same Supabase operation. Authorization fails closed whenever Supabase and Payload do not
resolve to the same eligible principal. No runtime path promises immediate invalidation of an already-issued Supabase
access token.

The operations workflow still owns platform-staff production writes. Clinic staff creation and lifecycle synchronization
are owned by the clinic onboarding service and Payload lifecycle hooks.
