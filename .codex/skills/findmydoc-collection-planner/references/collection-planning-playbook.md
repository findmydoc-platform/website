# findmydoc Collection Planning Playbook

## Discovery Scan

Use `rtk rg` before asking the user questions. Prefer targeted searches:

```bash
rtk rg "slug:|relationTo:|collection:|defaultPopulate|indexes:|trash:|stableIdField|stableIdBeforeChangeHook" src/collections src/payload.config.ts
rtk rg "export const .*: CollectionConfig|access:|platformOr|isPlatform|isClinic|isPatient|fieldAccess" src/collections src/access
rtk rg "makePermissionSuite|permissionMatrix|collectionContractRegistry" src/security tests/unit/access-matrix tests/integration/contracts
rtk rg "collection: '<slug>'|collection: \"<slug>\"|ensureBaseline|cleanupTestEntities|testSlug" tests src/endpoints docs
rtk rg "overrideAccess|context|req\\.payload|virtual:|versions:|drafts:|filterOptions|maxDepth|slugField" src tests
rtk rg "revalidate|audit|createdBy|editedBy|beforeChangeAssignClinicFromUser|updateAverage|stableIdBeforeChangeHook" src/collections src/hooks tests
```

Scan these files when relevant:

- master data: `src/collections/Treatments.ts`, `Categories.ts`, `Tags.ts`, `MedicalSpecialties.ts`
- clinic-owned data: `src/collections/Doctors.ts`, `ClinicTreatments/index.ts`, `ClinicGalleryEntries/index.ts`
- moderated/public data: `src/collections/Clinics.ts`, `Reviews.ts`
- media: `src/collections/*Media/index.ts` and `src/collections/common/mediaCollection.ts`
- access source of truth: `src/security/permission-matrix.config.ts`
- test registration: `tests/integration/contracts/collectionContractRegistry.ts`

## Decision Rules

Recommend a new collection only when the data has independent lifecycle, permissions, relationships, audit needs, indexing needs, or CMS ownership.

Prefer smaller shapes when possible:

- field: simple attribute of one existing record
- relationship: link with no relationship-specific fields
- join collection: relationship has fields such as price, status, sort order, ownership, source, or uniqueness
- global: singleton settings or platform-wide configuration
- media collection: upload ownership, storage path, or file access differs from existing media collections
- hook: side effect, cross-document validation, denormalization, ownership stamping, or audit trail
- field validation: local value checks with no side effects

## Question Bank

Ask only questions that change implementation. Use no more than 3 per round.

High-value questions:

- Who owns and edits this data: Platform, Clinic Staff, Patients, or the system?
- Who can read it publicly, and is there an approved/published state?
- Is this standalone data or an attribute of an existing collection?
- Does the relationship need its own fields, uniqueness, ordering, status, or audit trail?
- Should records be soft-deleted with `trash: true`?
- Does it need baseline seed data, demo seed data, or no seed data?
- Is this shown to patients, used only in admin, or used by automation?
- Which existing collection is the source of truth if data overlaps?
- Is this value a fixed business enum, or should operators manage it as dynamic content?
- Should this value be stored, virtual, or derived when read?
- Will hooks run nested Payload operations that need shared `req` transaction context or `context` loop guards?

Avoid questions about file locations, helper names, or test patterns when the repo answers them.

## Recommended Payload Patterns

Reuse existing helpers:

- `anyone`: public read
- `isPlatformBasicUser`: platform-only create/update/delete
- `platformOnlyOrApproved`: platform reads all, others read approved clinics
- `platformOnlyOrApprovedReviews`: review visibility
- `platformOrAssignedClinicMutation`: platform or assigned clinic create
- `platformOrOwnClinicResource`: platform or own-clinic resource scope
- `platformOnlyFieldAccess`: platform-only field mutation
- `beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })`: clinic ownership stamping
- `stableIdField()` plus `stableIdBeforeChangeHook`: stable seed/import identifiers

Collection defaults to consider:

- `timestamps: true`
- `trash: true` unless destructive deletion is explicitly required
- `admin.group`, `useAsTitle`, `defaultColumns`, and concise `admin.description`
- `defaultPopulate` for records commonly referenced by public pages or joins
- unique compound `indexes` for join collections

## Planning Output

A planning response should include:

- concrete discovery facts with paths
- likely model type and why
- anti-overengineering alternatives checked
- access model by role
- hook/helper suggestions
- migration/test/doc impact
- explicit assumptions
- one `<proposed_plan>` block
- a short implementation question after the plan

## Implementation Checklist After Approval

When the user approves implementation:

- create or update collection config under `src/collections/**`
- register it in `src/payload.config.ts`
- update `src/security/permission-matrix.config.ts`
- add `tests/unit/access-matrix/<slug>.permission.test.ts`
- add focused integration lifecycle/access/hook tests
- update `tests/integration/contracts/collectionContractRegistry.ts`
- create Payload migration with `pnpm payload migrate:create <migration_name>` for schema changes
- update seeds or `docs/guides/**` only when the behavior changes those flows

Never hand-write Payload migration files from scratch.

## Validation

For planning-only skill edits:

```bash
rtk pnpm format
rtk python3 /Users/razorspoint/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/findmydoc-collection-planner
```

For actual approved collection implementation, choose from:

```bash
rtk pnpm matrix:derive json
rtk pnpm matrix:verify
rtk pnpm vitest run tests/unit/access-matrix/<slug>.permission.test.ts
rtk pnpm vitest run tests/integration/<domain>.lifecycle.test.ts
rtk pnpm check
rtk pnpm build
```

Run `pnpm build` when build-relevant sources, Payload config, routing, or tooling output changes.
