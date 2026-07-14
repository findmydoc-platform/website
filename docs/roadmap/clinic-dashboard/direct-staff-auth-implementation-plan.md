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

1. start or join the Payload transaction that owns the principal mutation;
2. derive a stable PostgreSQL advisory-lock key from the normalized Supabase user ID;
3. acquire a transaction-scoped advisory lock through the same PostgreSQL session that executes the Payload
   transaction;
4. query all three auth collections while holding the lock;
5. permit creation only when no conflicting principal exists;
6. apply the intended mutation and any required Supabase classification change;
7. revoke refresh tokens and require a session refresh after a classification change;
8. verify that exactly one correctly classified principal remains; and
9. record enough state for reconciliation when Payload and Supabase operations partially succeed.

The advisory lock is invalid if it is acquired through a different pooled connection or outside the active Payload
transaction: the lock, all cross-collection checks, and the Payload mutation must share one PostgreSQL transaction
session. An in-process lock is insufficient because provisioning may run in multiple server instances. Payload and
Supabase cannot share one database transaction, so partial failures must leave access fail-closed and be recoverable
through an idempotent reconciliation path.

Supabase access JWTs cannot be revoked immediately. Revoking refresh tokens prevents future access-token renewal, but
an already issued access token remains valid until its expiry. Every request therefore resolves a current Payload
principal and rejects missing, reclassified, suspended, or otherwise unauthorized records even when the supplied JWT
is still cryptographically valid. Updated `app_metadata` classification becomes effective only after the client obtains
a refreshed access token.

A staff-category change must make the source principal non-authorizable before the new classification becomes usable.
If the target schema cannot express that safe intermediate state, implementation stops until the lifecycle contract is
extended. The implementation must never leave both source and target principals active.

## Portal and Payload Boundary

The runtime switch removes the clinic branch from the Payload Admin login and from portal login-role selection. The
portal login endpoint rejects `clinic` as a portal target. No portal route or redirect may imply that clinic staff can
enter Payload Admin.

Clinic invitation completion, password reset, and the generic authentication callback remain available until the
Clinic Dashboard owns those flows and the separate application-boundary gate has been satisfied. Removing those
transitional routes earlier would break account setup without providing a replacement. Patient login and public clinic
registration also remain unchanged.

The portal may later expose one normal navigation link to the standalone Clinic Dashboard. The link performs no
authentication and transfers no session.

Platform-staff Payload Admin login remains available. Payload continues to authenticate and authorize API requests
made by the Clinic Dashboard after the separate application-boundary gate has been satisfied.

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

The existing `userProfileMedia` collection and its Payload file URL remain the only personal profile-media delivery
path. Its storage and access contract is concrete:

- the object-storage bucket remains private;
- Payload storage access control remains enabled; `disablePayloadAccessControl` must not be enabled;
- local `staticDir` moves from `public/` to an ignored directory that Next.js does not serve directly;
- collection read access branches on Payload's `isReadingStaticFile` signal;
- ordinary metadata reads remain private to the owner and authorized platform staff;
- file reads are private by default and are evaluated by the same collection access rule rather than bypassing
  Payload through a public object or filesystem URL;
- protected file responses use private, non-shared cache semantics and `no-store`; and
- a known or previously observed file URL does not grant access.

The only anonymous file-byte exception is the current, non-deleted profile image of a platform author who is referenced
by at least one published post. For `isReadingStaticFile`, the access rule resolves those media IDs through internal
`depth: 0` queries and returns an ID-bounded Payload `Where` filter. Anonymous callers do not receive collection
metadata from this exception. Previous platform avatars, unused platform avatars, and all clinic and patient profile
files remain inaccessible.

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

Post-detail invalidation also refreshes any existing related-post projection that reads the changed author's public
projection. It uses the current post entity, slug, surface tags, and canonical post-detail paths; it does not introduce
staff tags, media tags, a related-post tag family, or a separate projection cache.

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

The additive expand stage provides a read-only preflight before any runtime or relationship switch. Its machine-readable
output contains aggregate counts, uniqueness results, and non-reversible inventory digests only. It never emits
names, email addresses, raw Supabase IDs, access tokens, or other clear-text identity data.

The preflight uses one repeatable-read, read-only PostgreSQL snapshot. Inventory digests are HMAC-SHA256 values keyed
with an execution-time secret that is never written to the report. The same key must be reused when comparing two
reports. A missing staff Supabase binding fails by default. Each controlled non-authenticating seed actor must be
allowed explicitly by its exact stable ID for that run; prefixes and implicit fixture detection are not accepted.

`pnpm staff-auth:inventory` is the explicit pre-migration inventory command and may report that the additive schema is
not present. After the expand migration, `pnpm staff-auth:preflight` is the rollout gate and fails unless every additive
identity column exists. Migration `up`, `status`, and schema-diff evidence separately verify the generated indexes and
foreign keys. Both commands require `STAFF_AUTH_PREFLIGHT_DIGEST_KEY`; controlled seed actors are passed individually
with `--allow-unbound-staff-stable-id=<stable-id>` after the pnpm argument separator.

The preflight records:

- counts and consistency digests for existing `basicUsers`, `platformStaff`, and `clinicStaff` records in each target
  environment;
- missing Supabase bindings, duplicate Supabase IDs within a collection, and cross-collection Supabase-ID collisions;
- missing, duplicate, or ambiguous staff-profile mappings;
- every relationship to `basicUsers`, including post authors, inquiry assignment, platform-content media creators,
  review editors, profile-media ownership, clinic applications, and shared creator relationships;
- a keyed relationship-inventory digest over the source table, source record, linked `basicUsers` record, and current
  staff classification;
- the mapping from each required platform actor to its target `platformStaff` principal;
- versioned post-author relationships in `_posts_v_rels`, not only the current `posts` row;
- `payload_mcp_api_keys` ownership and its internal relations;
- Payload preferences that refer to a `basicUsers` principal; and
- Payload document locks that refer to a `basicUsers` principal.

An existing platform identity or business relationship is migrated unless the inventory explicitly proves it is
disposable. The absence of active clinic users does not prove that platform actors or content relationships are
disposable.

### Reviewable stages

1. **Additive expand and preflight:** add the future identity fields to `platformStaff` and `clinicStaff` while
   `basicUsers`, current authentication, current relationships, and current portal behavior remain active. A generated
   expand migration backfills those fields without changing relationship targets. `platformStaff.stableId` remains its
   existing value. Each `clinicStaff.stableId` is copied from its single unambiguous linked `basicUsers` record. Name,
   email, Supabase binding, and profile image are copied only through unambiguous profile mappings. The migration and
   preflight abort on ambiguous mappings rather than guessing roles or ownership. `supabaseUserId` remains technically
   nullable for controlled non-authenticating seed actors; every operational or authenticating principal requires one
   non-empty, cross-collection-unique binding.
2. **Maintenance boundary:** before relation IDs are remapped, enable a maintenance state that blocks affected Payload
   Admin, REST, GraphQL, Local API, seed, background-job, provisioning, and Ops reads or writes. Public pages may serve
   already cached safe output, but cache misses must not query actor relationships while IDs can have mixed meaning.
   Drain in-flight work before proceeding. This boundary is required because existing integer relationship columns are
   reused for different target collections; old and new runtimes cannot safely interpret those IDs concurrently.
3. **Identity, relationship, and runtime switch:** within the maintenance window, repeat the identity backfill
   idempotently, remap every required actor relationship, deploy direct authentication and authorization, change Admin
   configuration, creator hooks, public author projection, lifecycle logic, and seeds, and verify the switched runtime
   before maintenance is lifted. When Payload would reuse one SQL column name for a new relationship target, the
   migration first renames the old column as legacy inventory, creates the active target column, and writes remapped
   IDs into that new column. It never changes the meaning of stored integer IDs in place. The migration includes current
   and versioned post-author relations in `_posts_v_rels`. Payload preferences are remapped to the corresponding direct
   platform principal. Existing MCP API key ownership is migrated only through an unambiguous platform-principal
   mapping; otherwise the switch aborts and the credential must be revoked and reissued. Payload document locks are
   ephemeral and are cleared during the maintenance window instead of remapped.
4. **Legacy inventory retention:** the switch keeps `basicUsers` temporarily registered as a hidden,
   non-authenticating legacy collection whose normal create, read, update, and delete access is denied. Its physical
   table and old relationship columns remain explicit migration inventory. Application, Ops, seed, and background-job
   paths do not read or write it and must not use Local API `overrideAccess` against it. Its continued registration is
   not a compatibility path.
5. **Pre-production fixture rebuild:** rebuild disposable clinic and test identities from the migration chain and apply
   target-state fixtures under an explicit non-production guard.
6. **Destructive contract:** after all rollout gates pass, remove legacy profile links, the `basicUsers` table, old
   relationship columns and constraints, and obsolete fallback code in a separately reviewed stage.

The destructive stage may run only when:

- all required platform identities have a working direct principal;
- every required actor relationship has been remapped and verified;
- no remaining active runtime or required stored relationship references `basicUsers`;
- duplicate Supabase identities have been rejected or reconciled;
- platform Admin access has been verified through `platformStaff`; and
- the target environment has an explicit backup or reproducible rebuild path appropriate to its data classification.

There is no dual-read, dual-write, or compatibility bridge for disposable clinic identities and sessions. Persisted
business relationships preserve their actor meaning even when their underlying document IDs change.

## Coordinated Ops Rollout

The trusted `fmd-ops platform-user` path changes from `basicUsers` plus a staff profile to direct `platformStaff` in a
coordinated Ops change. The Ops implementation is tested locally against the exact website runtime-switch branch. That
branch test validates contracts and request shapes without privileged environment writes.

Privileged Ops workflows accept the website contract from `website` `main` only. They must not weaken that guard to
run a dry-run against a feature branch. The rollout sequence is therefore:

1. validate the website switch and Ops integration locally against the exact switch revision;
2. enter the website maintenance boundary and deploy the verified website switch to `main`;
3. run the privileged Ops dry-run against that deployed website `main` contract;
4. merge the verified Ops change; and
5. permit an explicit `--apply` only after the website verification and privileged dry-run gates are both recorded.

Website staff provisioning and `fmd-ops platform-user --apply` share one rollout gate and one concurrency group for the
target environment. While either operation owns that group, another ensure, delete, seed, staff-category change, or
switch migration cannot start. Dry-run remains the default, and there is no temporary dual-model Ops path.

## Seed Contract

Non-production and test seeds may create:

- a fixture platform administrator through the controlled test provisioning path;
- least-privileged platform-staff fixtures;
- approved and non-approved clinic-staff fixtures with explicit clinic assignments;
- post authors that reference `platformStaff`; and
- media and gallery actors using collection-qualified relationships.

Every direct staff fixture has a stable ID owned by its target collection. A migrated `platformStaff` fixture keeps the
existing `platformStaff.stableId`; a migrated `clinicStaff` fixture receives the stable ID of its unambiguous linked
`basicUsers` record. Fresh fixtures declare stable IDs directly and relationships resolve by both target collection and
stable ID, never by an unqualified shared staff ID. Operational or login-enabled staff always require one unique
Supabase user ID. A controlled non-authenticating seed actor may leave `supabaseUserId` empty but can never pass the
authentication dispatcher.

Production-capable baseline seeds must not create a login-enabled platform administrator, send a Supabase invitation,
set a deterministic administrator credential, or elevate an existing account. The first production administrator and
all later administrative elevation use the trusted platform provisioning path.

Seeds must not recreate `basicUsers`, staff profile links, or shared staff IDs. Their terminal cache flush follows the
author and profile-media dependency contract above and uses only the existing post tags and paths.

## Verification Contract

Implementation verification covers:

- collection schema contracts for all three auth collections;
- disabled local passwords and Payload-managed sessions;
- `platformStaff` as the only Payload Admin user collection;
- explicit Admin denial for clinic staff and patients;
- dispatcher mapping and collection-qualified principals;
- missing, invalid, conflicting, and duplicate identity failure paths;
- concurrent provisioning of the same Supabase identity across different collections, with the advisory lock proven to
  use the active Payload transaction session;
- refresh-token revocation, access-JWT expiry behavior, and idempotent reconciliation after reclassification or partial
  failure;
- no staff creation during authentication and unchanged patient ensure-on-auth;
- least-privilege platform defaults and administrator-only elevation;
- rejection of self-promotion and unauthorized changes to another platform role;
- immutable or trusted-only identity bindings;
- approval and clinic-assignment enforcement;
- rejection of caller-provided tenant or creator identities;
- all actor relationship targets and creator-hook output;
- maintenance-mode rejection and in-flight drain while relation IDs change meaning;
- migration or explicit disposal evidence for every existing required platform actor relationship;
- remapping of `_posts_v_rels`, Payload preferences, and unambiguous MCP key ownership, plus clearing document locks;
- hidden, non-authenticating, access-denied registration of `basicUsers` while its legacy database inventory remains
  untouched and unused by application, Ops, seed, and background-job paths;
- private profile-media metadata and private-by-default file bytes, including unauthenticated known-URL access;
- anonymous file access limited to the current avatar of a platform author with a published post, with previous,
  unused, clinic, and patient files denied and protected responses marked `no-store`;
- unchanged public post-author projection;
- cache policy classification and all focused cache tests listed above, without staff or media tag families;
- target-state seed output and author/media-only terminal cache flush;
- local Ops integration against the exact website switch revision, the website-`main` guard for privileged dry-run,
  and the shared apply gate and environment concurrency group;
- explicit non-production guards for fixture rebuild operations;
- production baseline seeds that cannot create or elevate an administrator;
- absence of the clinic branch in Payload Admin and portal login-role selection;
- continued patient login, public clinic registration, clinic invitation completion, password reset, and generic auth
  callback behavior; and
- absence of production Dashboard CORS, callbacks, or API integration before the application-boundary gate.

## Out of Scope

- Clinic Dashboard UI implementation;
- the Dashboard origin and production domain;
- browser token transport and refresh behavior;
- CORS, CSRF, and cross-origin cookie configuration;
- a new public cache mechanism;
- a generic Actor or identity-registry collection; and
- compatibility with disposable non-production clinic identities or sessions.
