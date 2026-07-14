# Direct Staff Authentication Implementation Plan

## Purpose

This roadmap document translates
[ADR 025](../../adrs/025-adr-direct-staff-auth-collections.md) into a website-repository implementation contract. It
contains schema, authentication, relationship, migration, seed, and test details that are intentionally more changeable
than the architecture decision.

This document is planning context while the work remains open. After implementation, collection definitions,
migrations, access rules, and automated tests become the current engineering sources of truth.

## Scope Boundary

The website repository owns:

- Payload auth collections and access rules;
- Supabase identity dispatch at the Payload boundary;
- portal clinic-auth removal;
- actor relationships and creator hooks;
- public author projection and its revalidation path;
- migrations, non-production rebuilds, and target-state seeds; and
- contract, integration, and end-to-end tests for those behaviors.

The standalone Clinic Dashboard owns its login UI and browser session integration. Its exact origin, token transport,
CORS configuration, and API client contract require a separate application-boundary decision and are not specified
here.

## Target Collection Contracts

### `platformStaff`

The direct auth collection contains:

| Field | Purpose | Control |
| --- | --- | --- |
| `stableId` | Stable application identifier | System-managed |
| `supabaseUserId` | Unique Supabase identity binding | System-managed |
| `email` | Sign-in and staff contact address | Platform-controlled |
| `firstName` | Private staff profile | Explicit profile permissions |
| `lastName` | Private staff profile | Explicit profile permissions |
| `profileImage` | Private profile media relationship | Explicit profile permissions |
| `role` | Current platform authorization role | Platform-controlled |

Additional contract requirements:

- the collection is auth-enabled;
- Payload local passwords and Payload-managed sessions are disabled;
- it is the only collection configured as the Payload Admin user collection;
- email addresses must use the `@findmydoc.eu` domain;
- new records default to the `support` role; and
- administrative roles, including the initial administrator, are assigned explicitly.

### `clinicStaff`

The direct auth collection contains:

| Field | Purpose | Control |
| --- | --- | --- |
| `stableId` | Stable application identifier | System-managed |
| `supabaseUserId` | Unique Supabase identity binding | System-managed |
| `email` | Sign-in and staff contact address | Platform-controlled |
| `firstName` | Private staff profile | Explicit profile permissions |
| `lastName` | Private staff profile | Explicit profile permissions |
| `profileImage` | Private profile media relationship | Explicit profile permissions |
| `clinic` | Authoritative tenant assignment | Platform-controlled |
| `status` | Current approval state | Platform-controlled |

Additional contract requirements:

- the collection is auth-enabled;
- Payload local passwords and Payload-managed sessions are disabled;
- Payload Admin access is denied explicitly;
- business API access requires `status === "approved"` and a present `clinic` relationship;
- all other current or future statuses deny business access by default;
- clinic authorization always derives the clinic from the authenticated principal; and
- clinic assignment, approval, Supabase identity, and classification cannot be changed through self-service profile
  updates.

`clinicStaff` remains a private login identity. It is not reused as a public clinic-team profile.

### `patients`

The existing direct-auth collection and patient-specific field model remain unchanged. Payload local passwords and
Payload-managed sessions stay disabled. Patient ensure-on-auth remains the only automatic user-record creation path.

## Supabase Dispatcher Contract

The shared Payload authentication strategy performs these steps:

1. validate Supabase access-token or session material;
2. read the server-controlled `app_metadata.user_type` classification;
3. map `platform`, `clinic`, or `patient` to exactly one direct auth collection;
4. look up the record by `supabaseUserId` only in that collection;
5. return the record together with its collection slug as the authenticated principal; and
6. read current authorization data from that Payload record.

The classification claim selects a collection only. It never grants a platform role, clinic assignment, approval
state, or record-level permission.

Authentication fails closed when:

- the classification is absent, invalid, or conflicting;
- the selected staff record does not exist;
- the identity resolves to more than one auth collection;
- the current staff record does not satisfy its authorization requirements; or
- lookup or validation cannot complete reliably.

There is no fallback lookup in another collection. Staff records are provisioned before login. Category changes are
explicit provisioning operations. Every creation or reclassification path checks all direct auth collections for an
existing Supabase identity.

## Portal and Payload Boundary

The portal removes clinic-specific:

- login forms and role selection;
- invitation and password-completion screens;
- password-reset and account-management screens; and
- routes or redirects that imply clinic access to Payload Admin.

The portal may later expose one normal navigation link to the standalone Clinic Dashboard. The link performs no
authentication and transfers no session.

Platform-staff Payload Admin login, patient login, and public clinic registration remain available. Payload continues
to authenticate and authorize API requests made by the Clinic Dashboard.

## Actor Relationship Contract

| Relationship | Target collection or collections |
| --- | --- |
| Post authors | `platformStaff` |
| Patient-inquiry assignment | `platformStaff` |
| Platform-content media creator | `platformStaff` |
| Review editor | `platformStaff` |
| Clinic media creator | `platformStaff`, `clinicStaff` |
| Clinic-gallery media creator | `platformStaff`, `clinicStaff` |
| Clinic-gallery entry creator | `platformStaff`, `clinicStaff` |
| Doctor media creator | `platformStaff`, `clinicStaff` |
| Personal profile-media owner and creator | `platformStaff`, `clinicStaff`, `patients` |

Polymorphic relationships persist `{ relationTo, value }`. Creator hooks derive both properties from the authenticated
principal and replace caller-provided creator data.

The implementation removes:

- `platformStaff.user` and `clinicStaff.user` profile relationships to `basicUsers`;
- staff `userType` classification fields; and
- clinic-application relationships to `basicUsers`.

A clinic application may retain a direct `clinicStaff` relationship where the workflow requires a provisioned clinic
identity. No generic Actor or identity-registry collection is introduced.

## Profile Media and Public Author Contract

Personal profile media is private by default. Public reads are limited to platform-staff profile media required by the
safe public post-author projection. Clinic-staff and patient profile media remain private.

Post authors reference `platformStaff` directly. The public projection remains:

- `id`;
- `name`; and
- `avatar`.

The source changes without changing the public shape or meaning.

## Cache and Revalidation Contract

Authentication, sessions, staff records, clinic assignments, and approval state remain `private-live` and are not
stored in a shared persistent public cache.

Platform-author name or profile-image changes identify affected published posts and use the existing post revalidation
owner, tags, and paths. Seed completion performs the same bounded post-surface flush.

The implementation introduces no new cache class, tag family, invalidation owner, or cache storage layer.

## Migration and Rebuild Sequence

The schema transition is divided into reviewable stages:

1. **Target model:** make `platformStaff` and `clinicStaff` direct auth collections and add their complete target fields.
2. **Runtime switch:** move authentication, authorization, Admin configuration, relationships, creator hooks, public
   author projection, and seeds to the direct collections.
3. **Non-production rebuild:** verify the target environment is explicitly non-production, rebuild it from the migration
   chain, and apply target-state seeds.
4. **Destructive contract:** remove legacy profile links, `basicUsers`, its storage, and obsolete fallback code in a
   separately reviewed stage.

There is no productive data backfill, dual-read, dual-write, legacy-session bridge, or actor-ID preservation. The
destructive stage must remain isolated so the removal boundary is visible in review.

## Seed Contract

Target-state seeds create:

- the initial platform administrator with an explicitly assigned administrative role;
- least-privileged platform-staff fixtures where required;
- approved and non-approved clinic-staff fixtures with explicit clinic assignments where applicable;
- post authors that reference `platformStaff`; and
- media and gallery actors using collection-qualified relationships.

Seeds must not recreate `basicUsers`, Staff profile links, or shared Staff IDs.

## Verification Contract

Implementation verification covers:

- collection schema contracts for all three auth collections;
- disabled local passwords and Payload-managed sessions;
- `platformStaff` as the only Payload Admin user collection;
- explicit Admin denial for clinic staff and patients;
- dispatcher mapping and collection-qualified principals;
- missing, invalid, conflicting, and duplicate identity failure paths;
- no Staff creation during authentication and unchanged patient ensure-on-auth;
- least-privilege platform defaults and explicit administrative elevation;
- approval and clinic-assignment enforcement;
- rejection of caller-provided tenant or creator identities;
- all actor relationship targets and creator-hook output;
- private clinic and patient profile media;
- unchanged public post-author projection;
- post invalidation after platform-author name or profile-image changes;
- target-state seed output;
- explicit non-production guards for rebuild operations; and
- absence of clinic-login and clinic-account-management surfaces in the portal.

## Out of Scope

- Clinic Dashboard UI implementation;
- the dashboard origin and production domain;
- browser token transport and refresh behavior;
- CORS and cross-origin cookie configuration;
- a new public cache mechanism;
- a generic Actor or identity-registry collection; and
- compatibility with disposable non-production Staff records or sessions.
