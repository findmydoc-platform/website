# Payload Field Modeling Reference

Use this reference when planning or implementing collection fields. It is intentionally concise; rely on the repo's existing patterns first, then use this as a guardrail for Payload-specific choices.

Official Payload docs to re-check when uncertain:

- Collection config: `https://payloadcms.com/docs/configuration/collections`
- Fields overview: `https://payloadcms.com/docs/fields/overview`
- Relationship field: `https://payloadcms.com/docs/fields/relationship`
- Join field: `https://payloadcms.com/docs/fields/join`
- Collection access: `https://payloadcms.com/docs/access-control/collections`
- Collection hooks: `https://payloadcms.com/docs/hooks/collections`
- Field hooks: `https://payloadcms.com/docs/hooks/fields`
- Indexes: `https://payloadcms.com/docs/database/indexes`

## Collection Config Fields

For each new collection, decide these before coding:

- `slug`: stable API name; changing it later is a migration and code update.
- `labels`: add when the slug is compact or user-facing names need spaces.
- `admin.group`: keep navigation aligned with existing groups such as `Medical Network` or `Platform Management`.
- `admin.useAsTitle`: choose a readable top-level field; avoid `id` unless no better title exists.
- `admin.defaultColumns`: include fields operators scan most often.
- `admin.description`: short, plain, operator-facing purpose.
- `defaultPopulate`: include only small fields needed when this collection is referenced often.
- `access`: define create/read/update/delete, and `admin` only when auth/admin behavior needs it.
- `hooks`: use for lifecycle behavior, ownership stamping, denormalization, audit trails, or cross-document validation.
- `timestamps`: usually `true` for domain data.
- `trash`: usually `true` for domain records unless permanent deletion is required.
- `fields`: schema and Admin UI surface.
- `indexes`: use for frequent filters/sorts and unique relationship pairs.

## Field Type Choices

Prefer the simplest field that matches the data:

- `text`: names, short strings, URLs when custom validation is enough.
- `textarea`: longer plain text without rich formatting.
- `richText`: patient/operator content needing formatting.
- `email`: emails; prefer over text for email values.
- `number`: prices, ratings, numeric metrics; set `min`/`max` where meaningful.
- `date`: timestamps or business dates; use hooks for automatic audit timestamps.
- `checkbox`: booleans.
- `select`: controlled single or multi-choice values; centralize reusable option lists.
- `relationship`: reference another collection when the relationship has no extra attributes.
- `upload`: reference a media collection for files/images.
- `join`: virtual reverse view of another collection's relationship/upload field; it does not create the relationship by itself.
- `group`: nested object that belongs to the parent document.
- `array`: repeated homogeneous objects owned by the parent document.
- `tabs`: Admin UI organization for larger documents; not a domain concept.
- `row` and `collapsible`: Admin presentation only; do not use to imply data ownership.
- `point`: map coordinates.
- `json` or `code`: last resort for flexible data; avoid when typed fields are known.
- `blocks`: editorial page/content composition, not normal domain records.

## Relationship vs Join Collection vs Join Field

- Use a `relationship` field when the link has no attributes.
- Use a dedicated join collection when the link needs attributes such as price, role, status, ordering, source, provenance, uniqueness, ownership, or hooks.
- Use a `join` field on the parent only to expose the reverse side of an existing relationship/upload for Admin/API convenience.
- For join collections, add a unique compound `indexes` entry when duplicate pairs should be impossible.

## Official Payload Skill Lessons

Use these Payload-specific pitfalls as extra checks; do not copy generic official examples into findmydoc code.

- Select vs relationship: treat categories, tags, topics, labels, authors, assignees, reviewers, and values that operators may add/edit/remove as candidate relationship collections. Use `select` for fixed business enums such as internal user types, payment states, priorities, or draft/published states where code depends on the values.
- Computed values: check `virtual: true` and `afterRead` before persisting computed fields. Persist computed values only when sorting, filtering, query performance, or Admin visibility requires storage.
- Local API access: Payload Local API operations bypass access control by default. When operating on behalf of a user, explicitly consider `overrideAccess: false`.
- Hook transactions: pass `req` into nested Payload operations inside hooks when those operations should share request context and transaction behavior.
- Hook loops: use `context` flags when a hook writes data that can trigger the same hook path again.
- Relationship ergonomics: consider `filterOptions` to constrain selectable related docs and `maxDepth` to keep populated responses bounded.
- Draft workflows: recommend `versions` or `drafts` only for editorial or real publish workflows, not ordinary operational records.
- Upload fields: reference an upload collection only after confirming the media collection, ownership model, storage path, and file-read access.

## Field Options to Consider

- `required`: use for data that must exist for valid business behavior, not just UI convenience.
- `unique`: only for true global uniqueness; remember this affects duplication and migrations.
- `index`: add when filtering/sorting often or access rules depend on the field.
- `localized`: use for patient-facing content when translations differ by locale.
- `defaultValue`: use for safe initial states such as `draft` or `pending`.
- `min`/`max`: ratings, bounded numbers, and numeric sanity checks.
- `hasMany`: relationship/select/upload arrays; consider whether ordering matters.
- `admin.description`: explain what to enter, not implementation history.
- `admin.position: 'sidebar'`: secondary metadata, status, ratings, or computed values.
- `admin.readOnly`: computed or system-managed fields; still enforce writes with hooks/access if needed.
- `admin.condition`: hide fields for irrelevant roles, but do not rely on UI hiding for security.
- `access`: field-level rules for sensitive or platform-only fields.
- `hooks`: field-local derivation, normalization, or validation that belongs to one field.
- `validate`: local value checks that do not require database reads or side effects.

## Hooks vs Validation vs Access

- Use `validate` for local checks on a field value.
- Use field hooks for normalization or derivation of one field.
- Use collection hooks for cross-field, cross-document, ownership, audit, denormalization, or side effects.
- Use access functions for authorization and row-level filters; Payload access can return booleans or query constraints.
- Use Admin UI conditions only for operator ergonomics, never as the only enforcement.

## findmydoc Defaults

- Prefer `stableIdField()` and `stableIdBeforeChangeHook` for seed/importable domain collections.
- Prefer `trash: true` for clinic, doctor, treatment, review, content, and media domain records.
- Reuse access helpers from `src/access/**`; add new helpers only when no existing scope matches.
- Keep clinic-owned records scoped through existing clinic assignment helpers where possible.
- Keep computed fields read-only in Admin and update them via hooks or reusable utilities.
- Keep field descriptions short, plain, and useful for first-time clinic users.
