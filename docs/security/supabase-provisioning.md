# Supabase Provisioning

Supabase creates and manages external identities. Payload stores the direct application principals and remains the authorization source.

## Staff Provisioning

The trusted operations workflow creates, repairs, and deletes platform staff. It first verifies that the Supabase id is not assigned to a patient or clinic staff principal, ensures Supabase metadata identifies the account as `platform`, then creates or updates the matching `platformStaff` document. New platform staff default to `support`; an elevated role is always explicit.

Clinic staff are provisioned as direct `clinicStaff` principals by the clinic workflow. Login never creates them. An incomplete or unapproved clinic principal is not authorized.

All staff writes use the shared identity invariant: a transaction advisory lock serializes the Supabase id and Payload checks all auth collections before committing. This prevents cross-collection identity reuse while preserving collection-local unique constraints.

## Patient Provisioning

Patients retain ensure-on-auth. After Supabase confirms the browser identity, the strategy may create or update the matching `patients` principal idempotently. Patient creation does not create staff records or alter a staff classification.

## Failure Behavior

Authorization fails closed whenever Supabase and Payload do not resolve to the same eligible principal. Deleting a staff principal removes Payload authorization before external identity cleanup; a failed Supabase deletion is retried by the trusted operations workflow. No runtime path promises immediate invalidation of an already-issued Supabase access token.

The operations workflow owns production writes. The website only validates authentication and authorization at request time.
