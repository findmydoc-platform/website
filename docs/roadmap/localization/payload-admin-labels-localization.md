# Payload Admin Labels Localization Item

## Working Title

Payload admin labels remain English-first outside the localization rollout.

## Problem Statement

Payload admin users see collection names, field labels, field descriptions, tabs, helper text, and guidance copy while creating or reviewing content. Those labels are a separate concern from public localization and do not need to move with the first DACH-facing public rollout.

The current decision is to keep Payload Admin English. If this is not explicit, the public localization effort may accidentally absorb admin-label work that does not improve short-term SEO, public content readiness, or user-facing DACH launch quality.

## Intended Outcome

Payload Admin remains English-first. Collection, global, dashboard, and custom admin metadata should remain understandable and consistent, but no German Payload admin-label rollout is planned.

## Counter-Position

This item may now be the easiest one to overvalue. Translating admin labels is only useful if real editors or operators are blocked by the current admin language.

If the actual bottleneck is unclear content ownership, weak field modeling, missing guidance, or incomplete source content, translated labels will not fix the workflow. The stronger position is to keep the admin surface English and spend localization effort on public Product UI Copy and Payload Content.

## Scope

This item covers:

- Recording the decision that Payload Admin remains English.
- Keeping admin-label work separate from public Product UI Copy and Payload Content Localization.
- Rewriting the previous admin-label issue so it reflects the English-admin decision instead of tracking a German label rollout.
- Defining the minimum separate admin guide needed for localized-versus-shared content work.
- Keeping existing English labels, descriptions, and custom admin text coherent enough for editor and operator workflows.

This item does not cover:

- Public website copy.
- Product UI copy used by frontend or mobile components.
- Payload-owned content values entered by editors.
- German Payload admin-label implementation.
- A planned later German Payload admin-label implementation.
- Translating every Payload core interface string.
- Building the central Product UI Copy translation system or TMS workflow.
- Full UX-writing standardization across the product.

## Confirmed Decisions

- Payload Admin remains English.
- German Payload admin labels are not part of the public localization rollout and have no planned implementation sequence.
- `tr` is not part of the admin-label plan.
- Admin-label localization remains separate from Product UI Copy and Payload Content Localization.
- The previous admin-label issue should be rewritten and adapted to the English-admin decision instead of being closed as a stale localization request.
- Minimum guidance should live in a separate admin guide that explains localized-versus-shared fields, readiness, fallback, and SEO-sensitive workflows.
- If admin-label localization is ever reconsidered, it should still avoid the central Product UI Copy translation system unless a later ADR deliberately creates a shared admin translation backbone.

## Current Repository Facts

- Payload types support locale-keyed labels and descriptions through `StaticLabel`, `LabelFunction`, and `EntityDescription`.
- `@payloadcms/translations` is installed through Payload, but the repo does not currently define a custom root `i18n.translations` setup for these admin labels.
- Collection and field labels, descriptions, tabs, select options, and grouping text are currently distributed across collection and global config files.
- Existing custom admin surfaces include the Developer Dashboard widget, admin branding components, and custom guidance components such as Medical Specialties guidance.
- Payload admin UI rules require official Payload admin extension points and conservative styling.

## Implementation Rules

- Keep English as the technical and international baseline.
- Do not introduce `adminLabel({ en, de })` or similar helpers for this localization rollout.
- Keep field labels aligned with the domain model.
- Do not overload field descriptions as the primary training surface. Use a separate admin guide for localized-versus-shared, readiness, fallback, and SEO-sensitive workflows.
- Keep Product UI Copy and future TMS key governance separate from admin labels.
- Preserve enough consistency that typed admin-label helpers could be added later if a future ADR deliberately changes this decision.

## Implementation Sequence

- No admin-label localization sequence is planned.
- No later German admin-label sequence is currently planned.
- If localization is ever reconsidered, inventory should start with `DeveloperDashboard`, `AdminBranding`, `MedicalSpecialtiesAdminGuidance`, and Header/Footer RowLabels because those component-local surfaces are hardest to migrate cleanly after they grow.

## Open Risks

- English-only admin labels may still create editor onboarding friction if the admin guide is missing or outdated.
- Public localization still requires admin guidance that explains localized versus shared fields, even though the guidance remains English.
- Keeping custom admin text component-local is acceptable for the current decision, but it increases migration work if a future ADR deliberately changes admin-label localization.

ADR-level decisions that might later connect admin labels to a shared translation runtime are tracked in [Localization ADR decision backlog](./localization-adr-questions.md).

## Evidence To Check Before Issue Creation

- Review current collection labels, field labels, descriptions, and tabs across all Payload collections.
- Check Payload's current localization and admin i18n support in the installed version.
- Identify custom admin components or guidance blocks that already explain editor behavior.
- Confirm the first editor/operator personas and their working language.
- Inspect whether existing `label` and `admin.description` patterns are centralized or duplicated.

## Draft Acceptance Shape

- Admin-label ownership is documented separately from product UI copy and Payload content values.
- Payload Admin remains English and is explicitly out of the public localization rollout.
- The previous admin-label issue has a documented rewrite direction that reflects the English-admin decision.
- Any required localized-versus-shared field guidance remains understandable in English through a separate admin guide.
- The work avoids translating Payload core UI or collection metadata without concrete editor workflow evidence.
