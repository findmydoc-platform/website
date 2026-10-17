# Clinic groups and initial membership

Clinic groups are private back-office records. Persisted platform `admin` and `support` roles can create, read,
rename and delete groups through Payload Admin or its ordinary access-controlled API. A group has a stable ID
and a required display name. Clinic staff, including future group managers, receive no group administration or
Payload Admin access. A stale browser role value does not override the stored operator role.

The optional `clinics.group` relationship holds at most one group. An authorized operator can set it when creating
a clinic or attach an existing independent clinic. An unchanged membership remains valid. Existing memberships use the dedicated transfer or detachment
operation described below. Independent clinics require no group.
Initial attachment preserves clinic IDs, historical business records, local staff access, participation and public
publication. It does not activate a personal account or change operation permissions.

Group deletion rejects references from any clinic, including a soft-deleted clinic, and from personal staff
assignments. Personal assignment changes follow [the staff assignment policy](clinic-staff-assignments.md).

## Authorization ordering

Initial attachment and group removal share a native Payload transaction barrier. Attachment acquires the clinic
barrier and the destination group's barrier, then re-reads the group before persisting its relationship. Removal
acquires the same group barrier before checking clinic references. Locks remain held through native commit or
rollback. If attachment commits first, removal fails and preserves the reference. If removal commits first,
attachment fails without a dangling reference. A database conflict may abort the losing transaction.

Existing clinic and staff authorization writers acquire their barriers even without notification capture activation
or previously initialized controls. These are authorization controls, not activation flags. Native session checks
reject missing or replaced transactions. Separate native requests own competing transactions; nested writes reuse
their owner's transaction. No runtime SQL, adapter transaction controls or new automatic retry policy is introduced.
The ordering follows [ADR-036](../adrs/036-adr-clinic-authorization-mutation-ordering.md).


## Transfer and detachment

On an existing grouped clinic's Payload Admin edit screen, **Move clinic** appears in the sidebar for platform admin
and support operators. Select another group or **Independent clinic**, confirm the access change, and choose
**Move clinic**. Save or discard other clinic form edits first. The action uses the saved current group and reloads
the clinic only after success. A failed or stale operation shows its error without claiming that the move succeeded.

The control calls `POST /api/clinics/:id/group-membership` with `{ fromGroupId, toGroupId }`; detachment uses
`toGroupId: null`. `changeClinicGroup` checks the persisted operator role and submits only the group relationship
through native Payload. Its process-local capability binds the exact clinic and destination. The hook checks the
expected source group under the clinic barrier. A changed source returns 409 and requires a reload. Raw relationship
updates, override access, stale role claims and caller context objects do not authorize a transfer or detachment.

Movement changes current group membership only. Local assignments, principal IDs, identity subjects, activation
readiness, original completion evidence and clinic-owned records remain unchanged. Current eligible managers gain
or lose the clinic through `readClinicTargetAccess`; detachment grants no replacement group. Participation and public
publication stay independent and unchanged by movement. A participating draft clinic remains accessible to its
eligible staff without becoming public.

The mutation shares the clinic barrier with the representative direct Clinics business writer and acquires both
previous and destination group keys. Group deletion and reference changes therefore use the same transaction
ordering. A business change committed first remains in the clinic history. If movement commits first, the former
manager's later business change is rejected and rolls back. No automatic retry or external identity action occurs.

Real Payload/Postgres tests exercise the operator command and endpoint, current/former managers, local staff,
foreign targets, retained doctor ownership and principal evidence, stale and forged input, and both commit orders
for transfer and detachment against a real clinic profile mutation. The representative clinic profile is readable
under current membership. History acceptance for treatments, galleries, media, doctors, inquiries, reviews and
notifications still depends on their separate adapter conversions. Unconverted adapters remain closed to group
access; movement does not bypass retention, deletion or source availability.

## Cache and verification

The cache decision is `no-public-impact`. The policy catalog includes `clinicGroups` in the existing `private-live`
auth policy. Group metadata and clinic group relationships have no public projection, shared cache or new cache tag.
Existing clinic public-content hooks retain revalidation ownership.

The generated migration adds the group table and nullable clinic relationship without assigning existing clinics
to invented groups. It is additive. Previous code can use the expanded schema; the new code requires the migration.
Its rollback removes only the added relationship and table after dropping their explicit foreign keys.

Real Payload/Postgres lifecycle coverage exercises trusted group setup, new and existing clinic attachment,
restricted roles, retained local access, referenced deletion, missing transaction ownership and competing native
writers. The configured application environment, authenticated Admin visual QA, Preview qualification and Production
acceptance require their own evidence. Local fixture results establish none of those environment outcomes.

Isolated GroupMovement stories cover transfer confirmation, detachment, unsaved edits, pending work and rejected
membership changes. Chromium screenshots were checked at 320, 375, 640, 768 and 1024 pixels, with failure states
at mobile and desktop widths and a dark token theme. The controls stayed visible without horizontal overflow.
Keyboard checks cover destination → confirmation → action. These isolated checks do not verify the authenticated
Payload Admin composition; that runtime remains unavailable without an authorized existing session.
