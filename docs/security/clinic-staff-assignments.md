# Clinic staff assignments

A clinic principal has one assignment: `local` with one clinic, `group` with one group, or `unassigned` with neither
relationship. `replaceClinicStaffAssignment` submits all three persisted fields through the ordinary native Payload
update operation. Persisted platform `admin` and `support` operators can replace an activated person's assignment.
Partial updates, contradictory relationships, caller context flags and `overrideAccess` do not authorize replacement.
An onboarding clinic reference remains provisional until the existing trusted identity activation boundary completes.

Replacement preserves the principal ID, identity subject, approval and synchronization state, identity-bound readiness,
and immutable account-completion evidence. It performs no password or identity-provider mutation. Returning from a
group requires an explicit clinic. Revocation clears both relationships and never restores a former clinic. Staff
references also prevent group deletion, including when the group's eligible clinic set is empty.

## Current authorization

`readClinicPrincipalAccess` reads the current principal, lifecycle, synchronization, identity-bound readiness and
assignment from Payload on every request. It derives group membership from current clinic records, excluding deleted,
rejected and nonparticipating clinics. The returned clinic set is deterministic and contains every eligible member.
A valid person can have an empty set. An unassigned person, malformed assignment or empty group grants no clinic
access. The policy does not treat a token claim, browser selection or bootstrap snapshot as an assignment grant.

`readClinicTargetAccess` requires the exact target in that set. Direct `Clinics` collection reads and updates use this
policy. An optional route `clinicId` must match the actual source clinic. Collection and field operation permissions
still apply; group access grants neither group administration nor Payload Admin access. Public clinic reads retain
their existing publication filter.

The legacy `readClinicAccessState` adapter remains explicitly local-only. Bootstrap and workspace wire conversion
belongs to Dashboard #230. Other source-domain adapters remain closed to group access until Dashboard #231–238
and their Website dependencies convert them. They must use the current policy, explicit target and actual source
ownership; none may select a first clinic or infer access from bootstrap data. Clinic membership transfer and detachment use the [group movement operation](clinic-groups.md#transfer-and-detachment).
New-person invitations belong to Website #2181. These boundaries leave the
cross-repository acceptance criteria open.

## Native mutation ordering

Staff updates acquire the personal authorization key. Direct clinic business updates acquire both their source clinic
key and the acting person's key, then repeat current target authorization before native commit. Assignment validation
also acquires previous and destination group keys before checking the destination. Group deletion uses the same group
key before checking clinic and staff references. All keys remain within the owning native Payload transaction; missing
or replaced sessions abort. Notification capture does not enable or disable these barriers.

A business write that commits first remains valid and the later replacement takes effect afterward. A replacement
that commits first makes the later write fail without persisting its business change. Future domain writers must
participate in the same source and personal barrier protocol and repeat source authorization before commit, as required
by [ADR-036](../adrs/036-adr-clinic-authorization-mutation-ordering.md). No runtime SQL, automatic transaction retry or
independent transaction owner is introduced.

## Schema, cache and evidence

The generated `20261017_091316_clinic_staff_group_assignment` migration adds one nullable indexed staff group
relationship and its foreign key. It does not assign or activate existing people. Rollback removes only that added
relationship and index. Dependent staff schema must roll back before the earlier group-table migration.

Cache impact is `no-public-impact`: current person, assignment and eligible clinic reads remain request-bound under
the existing `private-live` authorization policy. No private shared cache, public projection or cache tag is added.
Existing public clinic content hooks retain invalidation ownership.

Real Payload/Postgres tests exercise local → group → explicit local → unassigned changes, preserved identity and
activation evidence, direct permitted and denied clinic targets, route/source mismatch, current lifecycle and clinic
eligibility, an empty group, staff reference protection, untrusted and partial input, and both commit orders for a
clinic business update against revocation or group replacement. Earlier notification and moderation fixtures use the
same trusted complete assignment boundary when simulating offboarding.

Authenticated Admin visual QA remains unverified because no authorized local Admin session is available. The local
fixture evidence does not establish Preview qualification, Production acceptance or complete downstream adapter
conversion.
