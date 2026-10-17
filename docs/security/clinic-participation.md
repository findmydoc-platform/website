# Clinic participation and password evidence

Application approval, account preparation, and public publication are distinct decisions. New approved applications
authorize the clinic and the named initial staff member. The clinic stays unpublished. Usable Dashboard access requires
current staff approval, synchronized Supabase identity, approved clinic participation, versioned activation readiness for
that exact personal principal and identity, an explicit local clinic assignment, and a clinic that is neither rejected nor deleted. Additional staff do not inherit the
application decision.

`clinics.participationStatus` controls participation. A null value preserves the old participation decision only for
an already publicly approved clinic. Newly created clinics receive `pending` unless the trusted application workflow
sets `approved`. Explicit participation rejection or disabling takes precedence over public publication. Public reads,
listing, media visibility, and discovery retain their existing publication filters.

## Private completion boundary

`clinicStaff.accountCompletion` stores source, Supabase subject, clinic ID, evidence time, observation time, and an optional
non-relational AuthAction ID. Field reads and normal writes are disabled, including Admin input. A collection hook also
rejects arbitrary Local API access overrides, JSON capabilities, and evidence replacement. Only an exact process-local
write capability from the trusted command can persist evidence. It uses Payload-native operations and borrowed request
context, without introducing transaction-control exceptions.

`recordClinicInitialPasswordCompletion` requires a completed identity-bound `clinic-invitation` plus server-verified
current password authentication. It checks subject, normalized principal email, provider-owned clinic classification,
staff synchronization, current lifecycle, approved application binding, and clinic participation. The existing Website
Auth-action protocol calls this internal command after observing the password update and completing the bound action.
It performs a fresh ordinary password login and records evidence before acknowledging Dashboard completion. The checked
staff and tenant binding is revalidated after password verification and enforced by the protected write capability.
No new public HTTP adapter is introduced. Recovery alone does not populate initial invitation evidence.

The durable evidence survives the 42-day AuthAction retention sweep. Its observation timestamp records when Website
verified and persisted the evidence. A password authentication timestamp establishes password usability at that time;
it never reconstructs the historical instant of the first password change.

## Identity-bound local activation

`activationReadiness` stores `identity-v1`, the personal principal ID, its Supabase subject, and the time Website
established readiness. Normal field reads and writes are disabled. The existing process-local evidence capability
also protects readiness from privileged overrides, Admin input, browser input, seed context, and replacement.
A copied readiness record does not activate another principal or replacement identity.

`convertClinicStaffLocalAccess` validates the original subject, clinic, source and timestamps before deriving readiness.
It writes readiness and `assignmentScope: local` together through native Payload hooks. The additive migration freezes the same original-evidence checks in its generated schema backfill,
limited to existing clinic assignments without an explicit scope. Missing or inconsistent original evidence
still produces explicit local scope, but no readiness and no clinic access. Repeated conversion retains existing
readiness and the original immutable `accountCompletion`. No principal, identity, password, approval state or clinic
is replaced. Independent clinics receive no group. New trusted password completion commands establish readiness in
the same protected update as their original completion evidence.

Original completion evidence remains historical. A later explicit assignment change does not invalidate identity-bound
readiness. Before readiness exists, the evidence guard rejects assignment changes that would invalidate a valid
original clinic check. Staff lifecycle, identity synchronization, current assignment, clinic participation, public
publication and operation permissions keep their own checks. Assignment alone never establishes activation.
The existing pending/restricted flow and trusted activation or recovery process apply when readiness is absent.

The migration adds nullable columns and backfills through the trusted command. Old code can read the additive schema;
new code requires explicit local scope and readiness. Existing sessions and older Dashboard clients have no
compatibility bridge. Deployment and environment activation require separate authorization and acceptance evidence.

## Additive legacy transition

The generated migration adds nullable evidence and provisioning fields. It snapshots existing approved, synchronized
staff with an identity and a publicly approved non-deleted clinic through the Payload Local API. It stores the exact
subject and tenant, without changing staff status or inventing completion timestamps. Pending, failed, disabled,
rejected, offboarded, deleted, and newly provisioned participants are not enrolled by this transition.

The snapshot marks an initial participant only when exactly one completed approved application links that staff and
clinic and both onboarding keys match it. The runtime fallback accepts only that initial cohort. Website verifies the
explicit Bearer token using Supabase `getUser` and `getClaims`; a password AMR event must be no more than five minutes old
and no earlier than the snapshot. A generic session, token issue time, `last_sign_in_at`, invitation acceptance, editable
metadata, or another AMR method cannot create evidence. A changed subject or clinic invalidates eligibility.

Already authorized additional legacy staff require authoritative historical evidence; they do not receive the password
fallback. Where such evidence is unavailable, access cannot be silently preserved by flags. The rollout owner must
resolve those specific records before switching access checks.

## Controlled historical import

`importLegacyClinicPasswordEvidence` accepts an offline operator-reviewed manifest authenticated with HMAC-SHA-256 and a
dedicated environment-specific key of at least 32 bytes. The trusted server caller binds the expected environment and
installed Auth version. The command validates the signature over the exact manifest bytes, closed schema, event name,
self actor, timing, identity, current staff lifecycle and synchronization, clinic, and migration snapshot. Imported events
must precede the snapshot. It uses native Payload writes and creates `legacy-audit` evidence only once.

The manifest contains `version: 1`, `environment`, `authVersion`, numeric `clinicStaffId` and `clinicId`, UUID `subject`,
`actorSubject` and `eventId`, `event: user_updated_password`, `context: authenticated-user`, and ISO timestamps
`identityCreatedAt`, `eventAt` and `reviewedAt`. The review attests the installed version's successful-password-change
semantics and committed outcome for the exact provider identity. The signing key is never supplied by browser input or
stored in the repository. Operator signing, key provisioning, and live import remain separately controlled operations.

Before signing, the operator verifies the correct project and installed Auth version, event transaction outcome,
actor/context, exact linked identity, and event timing from authoritative Supabase audit evidence. The
[Supabase audit reference](https://supabase.com/docs/guides/auth/audit-logs) distinguishes `user_updated_password` from
`user_recovery_requested`. Documentation alone does not establish the installed provider's behavior or prove a real
account completed its password. Missing or inaccessible audit records do not prove absence of a password.

Neither the import nor the fallback approves a participant, changes a tenant, enables a provider identity, or publishes
a clinic. Audit exports, personal logs, passwords, hashes, tokens, and provider responses stay outside repository and PR
artifacts. Only non-secret evidence metadata is retained privately. Apply the migration and resolve real historical
evidence under the platform rollout owner before activating the changed access checks.

## Cache and verification

The cache decision is `no-public-impact`. Participation and completion belong to the existing `private-live` auth policy.
There is no new cache class, tag, invalidation owner, or public route. Published profile mutations retain established
invalidation; participation changes never substitute for publication.

Focused unit contracts exercise incomplete-account denial, unpublished participation, tenant/identity changes, lifecycle
denials, password-only legacy evidence, closed writes, and signed import rejection. The database-backed application
approval integration exercises native hooks, public invisibility, forged evidence rejection, and retry reuse in CI.
These tests do not establish real provider audit availability or deployed end-to-end password completion.

## Personal group invitation origin

The Clinic Group Admin control prepares a personal invitation through the trusted operator command. The hidden
`personalGroupInvitation` stores its original group ID, operator ID, and authorization time. These nullable fields
and the reserved `personal-group-invitation:` onboarding key are protected by a process-local capability. Raw REST,
Admin field edits, access overrides, and fabricated request flags cannot mint or replace this origin. The temporary
provisional group assignment remains unusable until trusted password completion creates identity-bound readiness.

`group-initial-password` adds principal/group identifiers to immutable `accountCompletion` while retaining the exact
subject and completed Auth action. It leaves `clinicId` empty. Later assignment changes retain this historical origin
and personal readiness; current authorization still derives current membership and participation on every request.
The migration is additive: nullable columns and one enum value, without backfill or existing evidence replacement.
Old and new application versions can use the expanded schema; rollback after new group evidence exists requires
preserving that evidence rather than running the generated destructive down migration.

This remains `no-public-impact` in the existing `private-live` cache policy. No public projection, cache tag, shared
private cache, delivery activation, hosted provider identity, or domain-adapter conversion is introduced.

Local verification covers real Payload/Postgres writes with provider mocks, additive migration replay, principal reuse,
unconfirmed provider outcomes, generic-session denial, immutable proof replay, foreign-clinic denial, and both commit
orders of activation versus participation revocation. Existing local activation and assignment regressions remain green.
Paired controlled Dashboard journeys cover fresh login/bootstrap, an empty eligible clinic set, and invalid completion
grants. These are distinct from a hosted provider activation journey.

The isolated Admin control was checked at 320, 375, 640, 768, and 1024 pixels, including failure and inactive-delivery
states. Authenticated native Admin composition remains unverified because no existing authorized session was available.
No hosted identity, live invitation, credential refresh, or delivery activation was performed.
