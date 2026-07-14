# Direct Staff Authentication Implementation Plan

## Purpose

This roadmap document translates
[ADR 025](../../adrs/025-adr-direct-staff-auth-collections.md) into a website-repository implementation contract. It
contains schema, authentication, relationship, migration, seed, cache, and verification details that are intentionally
more changeable than the architecture decision.

This document is planning context while the work remains open. After implementation, collection definitions,
migrations, access rules, cache policy, and automated tests become the current engineering sources of truth.

## Scope Boundary

The website repository owns:

- Payload auth collections and access rules;
- Supabase identity dispatch and staff provisioning at the Payload boundary;
- portal clinic-auth removal;
- actor relationships and creator hooks;
- private profile-media delivery and the public author projection;
- public author revalidation through the existing post cache architecture;
- migrations, pre-production rebuilds, and target-state seeds; and
- contract, integration, and end-to-end tests for those behaviors.

The standalone Clinic Dashboard owns its login UI and browser session integration. Its exact origin, token transport,
refresh behavior, CORS configuration, CSRF protection, callback targets, and API client contract require a separate
application-boundary decision.

That deferred decision is a release gate. This work must not enable production Dashboard API access, add a Dashboard
origin to CORS, or send clinic invitation callbacks to the Dashboard before the application-boundary decision is
approved and implemented.

## Target Collection Contracts

### `platformStaff`

The direct auth collection contains:

| Field | Purpose | Control |
| --- | --- | --- |
| `stableId` | Stable application identifier | System-managed |
| `supabaseUserId` | Unique Supabase identity binding | Trusted provisioning only |
| `email` | Sign-in and staff contact address | Platform-controlled |
| `firstName` | Private staff profile | Explicit profile permissions |
| `lastName` | Private staff profile | Explicit profile permissions |
| `profileImage` | Private profile-media relationship | Explicit profile permissions |
| `role` | Current platform authorization role | Administrator or trusted provisioning only |

Additional contract requirements:

- the collection is auth-enabled;
- Payload local passwords and Payload-managed sessions are disabled;
- it is the only collection configured as the Payload Admin user collection;
- email addresses must use the `@findmydoc.eu` domain;
- new records default to the `support` role;
- an authenticated staff member cannot change their own role or identity binding;
- non-administrative staff cannot change another staff member's role or identity binding;
- administrative elevation requires an already authorized administrator or a trusted system provisioning path; and
- the initial administrator uses the trusted provisioning path, not an ordinary production seed.

Collection access and field access must enforce these rules independently of UI visibility. Negative tests cover both
self-promotion and promotion of another account.

### `clinicStaff`

The direct auth collection contains:

| Field | Purpose | Control |
| --- | --- | --- |
| `stableId` | Stable application identifier | System-managed |
| `supabaseUserId` | Unique Supabase identity binding | Trusted provisioning only |
| `email` | Sign-in and staff contact address | Platform-controlled |
| `firstName` | Private staff profile | Explicit profile permissions |
| `lastName` | Private staff profile | Explicit profile permissions |
| `profileImage` | Private profile-media relationship | Explicit profile permissions |
| `clinic` | Authoritative tenant assignment | Platform-controlled |
| `status` | Current approval state | Platform-controlled |

Additional contract requirements:

- the collection is auth-enabled;
- Payload local passwords and Payload-managed sessions are disabled;
- Payload Admin access is denied explicitly;
- business API access requires `status === "approved"` and a present `clinic` relationship;
- all other current or future statuses deny business access by default;
- clinic authorization always derives the clinic from the authenticated principal;
- profile self-service cannot alter classification, identity binding, clinic assignment, or approval; and
- clinic users can never assign or change platform roles.

`clinicStaff` remains a private login identity. It is not reused as a public clinic-team profile.

### `patients`

The existing direct-auth collection and patient-specific field model remain unchanged. Payload local passwords and
Payload-managed sessions stay disabled. Patient ensure-on-auth remains the only automatic user-record creation path and
must participate in the same cross-collection identity uniqueness checks.

## Supabase Dispatcher Contract

The shared Payload authentication strategy performs these steps:

1. validate Supabase access-token or session material;
2. read the server-controlled `app_metadata.user_type` classification;
3. map `platform`, `clinic`, or `patient` to exactly one direct auth collection;
4. resolve the record by `supabaseUserId` in the selected collection;
5. verify that the same Supabase identity does not exist in either non-selected auth collection;
6. return the record together with its collection slug as the authenticated principal; and
7. read current authorization data from that Payload record.

The classification claim selects a collection only. It never grants a platform role, clinic assignment, approval
state, or record-level permission.

Authentication fails closed when:

- the classification is absent, invalid, or conflicting;
- the selected staff record does not exist;
- the identity resolves to more than one auth collection;
- the current staff record does not satisfy its authorization requirements; or
- lookup or validation cannot complete reliably.

There is no fallback lookup in another collection and no generic identity-registry collection.

### Cross-collection identity lifecycle

Every staff creation, patient ensure-on-auth, identity repair, and staff-category change passes through one controlled
server-side lifecycle service. Direct collection writes must not bypass its identity checks.

The lifecycle service must:

1. acquire a database-backed, cross-instance serialization lock keyed by Supabase user ID;
2. query all three auth collections while holding the lock;
3. permit creation only when no conflicting principal exists;
4. apply the intended mutation and any required Supabase classification change;
5. revoke or refresh sessions after a classification change;
6. verify that exactly one correctly classified principal remains; and
7. record enough state for reconciliation when Payload and Supabase operations partially succeed.

An in-process lock is insufficient because provisioning may run in multiple server instances. Payload and Supabase
cannot share one database transaction, so partial failures must leave access fail-closed and be recoverable through an
idempotent reconciliation path.

A staff-category change must make the source principal non-authorizable before the new classification becomes usable.
If the target schema cannot express that safe intermediate state, implementation stops until the lifecycle contract is
extended. The implementation must never leave both source and target principals active.

## Portal and Payload Boundary

The portal removes clinic-specific:

- login forms and role selection;
- invitation and password-completion screens;
- password-reset and account-management screens; and
- routes or redirects that imply clinic access to Payload Admin.

The portal may later expose one normal navigation link to the standalone Clinic Dashboard. The link performs no
authentication and transfers no session.

Platform-staff Payload Admin login, patient login, and public clinic registration remain available. Payload continues
to authenticate and authorize API requests made by the Clinic Dashboard after the separate application-boundary gate
has been satisfied.

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

Personal profile media is private by default. Privacy covers both Payload metadata and the stored file bytes. An
unauthenticated caller must not retrieve clinic-staff or patient files through a known or previously observed object
URL.

The implementation must provide protected file delivery for clinic and patient profile media through private storage,
an authenticated proxy, signed short-lived delivery, or another mechanism with equivalent access enforcement. A path
under a publicly served directory or an unprotected storage object is not sufficient.

Public access is limited to the safe avatar representation of platform staff who are used as public post authors. It
must not make every platform-staff profile-media record publicly readable. The post-author projection is the public
boundary and remains:

- `id`;
- `name`; and
- `avatar`.

Post authors reference `platformStaff` directly. The projection source changes without changing its public shape or
meaning.

## Cache and Revalidation Contract

### Decision

The cache-impact decision is `public-cached` for the derived public post-author projection. Direct authentication,
session, staff, role, clinic-assignment, approval, and profile-media reads remain `private-live` and never receive
shared public cache tags.

### Dependency map

The public dependency is:

`posts.authors` → `platformStaff` → `profileImage` → `userProfileMedia` → `posts.populatedAuthors`.

Public outputs include post details, post lists, homepage teasers, and partner-clinic teasers. Private and excluded
inputs include sessions, roles, clinic assignment, approval, clinic and patient media, drafts, previews, Admin state,
and request-bound authorization data.

Relevant write events are:

- a public platform author's name change;
- a change from the previous to the next `platformStaff.profileImage` relationship;
- change, trash, or deletion of a referenced `userProfileMedia` record;
- deletion of a referenced platform author, or an explicit rejection of that deletion;
- a post-author relationship change; and
- terminal seed completion after author or profile-media fixture changes.

### Read/write symmetry

The implementation reuses:

- `critical-public` for post details;
- `aggregated-public` for post lists and landing surfaces;
- the existing `route:posts:detail` and `route:posts:list` policy entries;
- existing post collection, entity, slug, and surface tags; and
- the existing `collection-hook` invalidation owner and post planner events.

The author and media hooks resolve only affected published posts, then emit the existing normalized post events. They
must retain previous and next profile-image identities and preserve the previous owner or reference identity during
media deletion. Planner output remains bounded to the affected current or previous post slugs plus existing list and
landing surfaces.

The policy catalog may gain an explicit dependency entry connecting the private author sources to the public post
projection. It must not add `platformStaff:*` or `userProfileMedia:*` public tag families, change cache classes, or add
a new invalidation owner.

### Seed final flush

Seeds suppress per-record revalidation and therefore perform one terminal flush. Author- and profile-media seed work
must carry the affected published post slugs into that flush or resolve them once at completion. The final plan must
invalidate existing post list and landing tags as well as every affected post-detail path. A collection-only flush that
omits post details does not satisfy the contract.

### Cache verification

Focused cache tests cover:

- platform-author name changes;
- previous and next profile-image relationship changes;
- referenced profile-media change, trash, and deletion;
- unchanged fields as a revalidation no-op;
- `context.disableRevalidate`;
- platform-author deletion or deletion rejection while referenced;
- exclusion of clinic and patient media;
- exact affected published post slugs and existing canonical tags;
- author- or media-only seed finalization including detail paths; and
- read/write symmetry between post loader tags, hooks, planner, and executor.

No additional cache ADR is required while implementation stays within these existing classes, tag families, owner, and
invalidation semantics. Implementation stops for a separate architecture decision if it requires a new cache class,
tag family, owner type, route family, storage layer, or invalidation model.

## Pre-production Migration and Rebuild

The platform is pre-production but not empty. Existing schema, fixtures, operational platform identities, content, and
actor relationships must be treated separately from disposable clinic test identities.

### Inventory gate

Before generating or approving destructive migration work, record:

- every existing `basicUsers`, `platformStaff`, and `clinicStaff` record in each target environment;
- whether a `basicUsers` record is an operational platform identity, a clinic fixture, or disposable test data;
- every relationship to `basicUsers`, including post authors, inquiry assignment, platform-content media creators,
  review editors, profile-media ownership, clinic applications, and shared creator relationships; and
- the mapping from each required platform actor to its target `platformStaff` principal.

An existing platform identity or business relationship is migrated unless the inventory explicitly proves it is
disposable. The absence of active clinic users does not prove that platform actors or content relationships are
disposable.

### Reviewable stages

1. **Target model:** make `platformStaff` and `clinicStaff` direct auth collections and add their complete target fields.
2. **Identity and relationship migration:** create or complete direct platform principals and remap every required
   `basicUsers` actor relationship. The existing profile link may be used as the mapping source only while it remains
   present and unambiguous.
3. **Runtime switch:** move authentication, authorization, Admin configuration, relationships, creator hooks, public
   author projection, lifecycle logic, and seeds to the direct collections.
4. **Pre-production fixture rebuild:** rebuild disposable clinic and test identities from the migration chain and apply
   target-state fixtures under an explicit non-production guard.
5. **Destructive contract:** remove legacy profile links, `basicUsers`, its storage, and obsolete fallback code in a
   separately reviewed stage.

The destructive stage may run only when:

- all required platform identities have a working direct principal;
- every required actor relationship has been remapped and verified;
- no remaining runtime or stored relationship references `basicUsers`;
- duplicate Supabase identities have been rejected or reconciled;
- platform Admin access has been verified through `platformStaff`; and
- the target environment has an explicit backup or reproducible rebuild path appropriate to its data classification.

There is no dual-read, dual-write, or compatibility bridge for disposable clinic identities and sessions. Persisted
business relationships preserve their actor meaning even when their underlying document IDs change.

## Seed Contract

Non-production and test seeds may create:

- a fixture platform administrator through the controlled test provisioning path;
- least-privileged platform-staff fixtures;
- approved and non-approved clinic-staff fixtures with explicit clinic assignments;
- post authors that reference `platformStaff`; and
- media and gallery actors using collection-qualified relationships.

Production-capable baseline seeds must not create a login-enabled platform administrator, send a Supabase invitation,
set a deterministic administrator credential, or elevate an existing account. The first production administrator and
all later administrative elevation use the trusted platform provisioning path.

Seeds must not recreate `basicUsers`, staff profile links, or shared staff IDs. Their terminal cache flush follows the
author and profile-media dependency contract above.

## Verification Contract

Implementation verification covers:

- collection schema contracts for all three auth collections;
- disabled local passwords and Payload-managed sessions;
- `platformStaff` as the only Payload Admin user collection;
- explicit Admin denial for clinic staff and patients;
- dispatcher mapping and collection-qualified principals;
- missing, invalid, conflicting, and duplicate identity failure paths;
- concurrent provisioning of the same Supabase identity across different collections;
- session refresh or revocation and idempotent reconciliation after reclassification or partial failure;
- no staff creation during authentication and unchanged patient ensure-on-auth;
- least-privilege platform defaults and administrator-only elevation;
- rejection of self-promotion and unauthorized changes to another platform role;
- immutable or trusted-only identity bindings;
- approval and clinic-assignment enforcement;
- rejection of caller-provided tenant or creator identities;
- all actor relationship targets and creator-hook output;
- migration or explicit disposal evidence for every existing required platform actor relationship;
- private clinic and patient profile-media metadata and file bytes, including unauthenticated known-URL access;
- public access limited to the safe platform-author avatar projection;
- unchanged public post-author projection;
- cache policy classification and all focused cache tests listed above;
- target-state seed output and author/media-only terminal cache flush;
- explicit non-production guards for fixture rebuild operations;
- production baseline seeds that cannot create or elevate an administrator;
- absence of clinic-login and clinic-account-management surfaces in the portal; and
- absence of production Dashboard CORS, callbacks, or API integration before the application-boundary gate.

## Out of Scope

- Clinic Dashboard UI implementation;
- the Dashboard origin and production domain;
- browser token transport and refresh behavior;
- CORS, CSRF, and cross-origin cookie configuration;
- a new public cache mechanism;
- a generic Actor or identity-registry collection; and
- compatibility with disposable non-production clinic identities or sessions.
