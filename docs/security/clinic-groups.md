# Clinic groups and initial membership

Clinic groups are private back-office records. Persisted platform `admin` and `support` roles can create, read,
rename and delete groups through Payload Admin or its ordinary access-controlled API. A group has a stable ID
and a required display name. Clinic staff, including future group managers, receive no group administration or
Payload Admin access. A stale browser role value does not override the stored operator role.

The optional `clinics.group` relationship holds at most one group. An authorized operator can set it when creating
a clinic or attach an existing independent clinic. An unchanged membership remains valid. Replacing or clearing
an existing membership is rejected until the separate transfer/detachment workflow is delivered under
[Website #2184](https://github.com/findmydoc-platform/website/issues/2184). Independent clinics require no group.
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
