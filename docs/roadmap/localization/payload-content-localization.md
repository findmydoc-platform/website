# Payload Content Localization Item

## Working Title

Payload content localization needs a post-pilot rollout model for editorial and domain content.

## Problem Statement

findmydoc has already piloted native Payload localization for Pages and Posts. The pilot proves that localized editorial content can work, but it does not define how localization should expand across clinic profiles, treatment categories, landing pages, FAQs, trust content, globals, SEO fields, media alt text, and other domain content.

Without a post-pilot model, localization decisions will happen field by field during feature work. That creates inconsistent authoring behavior, unclear fallback expectations, and avoidable migration risk.

## Intended Outcome

Payload CMS becomes the source of truth for localized editorial, SEO-relevant, and domain-specific content. Every Payload collection or global that owns editorial, SEO-relevant, or domain-specific content has an explicit decision for localized fields, shared fields, relationships, fallback behavior, and migration impact.

The rollout should stay incremental and evidence-based. The first implementation sequence starts with taxonomy content, then shared globals and landing content, then clinic and doctor profile content. Sequencing must not reduce the final coverage requirement.

## Counter-Position

This item can easily become a content-model expansion disguised as localization. The team should not localize every field merely because Payload supports it.

The strongest objection is business readiness: localized schema fields do not create good localized content. Clinic profiles, treatment pages, trust claims, and medical copy need source quality, ownership, and review capacity first. If those are weak, localization may multiply content gaps rather than solve them. Full model coverage should mean every relevant model receives an explicit localized-versus-shared decision, not that every field becomes localized.

## Scope

This item covers:

- Inventory of Payload collections, globals, and key fields that can contain localized content.
- Field-level decisions for localized versus shared data.
- Native Payload localization rollout beyond Pages and Posts.
- Localized slug support following the ADR decisions for public URL, canonical, redirect, `hreflang`, and sitemap behavior.
- Seed, migration, type generation, and documentation needs for every covered content model.
- Editorial fallback behavior, translation completeness visibility, and per-locale readiness through Payload `localizeStatus` for localized public models.
- Content ownership rules for static routes that still need Payload-managed marketing or SEO copy.

This item does not cover:

- Product UI labels, validation messages, table headers, and reusable microcopy.
- Payload admin field labels and helper text.
- A custom translation table outside native Payload localization.
- Domain migration implementation from `.eu` to `.de` and `.com`.
- Bulk translation of all existing content as part of the schema rollout.

## Confirmed Decisions

- Phase-1 locale scope is `de` and `en`.
- `de` is the target default and source locale because findmydoc starts with the DACH region.
- `en` is the first alternative locale.
- `tr` is not part of the first rollout and moves to future backlog.
- Taxonomy content is implemented first: `Treatments`, `MedicalSpecialties`, `Categories`, `Tags`, `Accreditation`, `Countries`, and `Cities`.
- Shared globals and landing content follow taxonomy content: `Header`, `Footer`, `CookieConsent`, and `LandingPages`.
- Clinic and doctor profile content follows after taxonomy and global content.
- Localized slugs are planned for all public models that expose localized public URLs, including Pages, Posts, Clinics, Doctors, Treatments, and taxonomy pages. Implementation follows the ADR routing, SEO, fallback, redirect, and sitemap rules.
- Existing localized Pages and Posts pilot data is handled as a seed-level source reset to `de`, not as a production data migration, unless real CMS-authored production content exists before rollout.
- Existing English seed and pilot content must be preserved as `en` alternative-locale content during the reset. German default/source values are translated or adapted from the existing English baseline and then reviewed as the new source content.
- Phase 1 uses Payload per-locale Draft/Publish via `localizeStatus` as the readiness signal for localized public models.
- `localizeStatus` is introduced model by model once a model is localized and publicly/indexably used. There is no big-bang rollout across all collections.
- Implementation must verify the installed Payload version and automated tests before relying on `localizeStatus`. If `localizeStatus` is not reliable enough, the ADR decision must be reopened instead of silently falling back to heuristics.
- A locale route is ready only when the route document and all visible localized required dependencies are ready and published in the same locale.
- Indexable English routes must not render visible German fallback values. Fallback remains allowed only for Preview and Admin Review where it is visibly marked.
- Full model coverage means every relevant model gets an explicit localized-versus-shared decision. It does not mean every field becomes localized.
- English public routes are exposed only for indexable public route types with real reviewed English content. German-only content remains out of English navigation, sitemap, `hreflang`, and indexable metadata until it is ready.
- Home, partner/registration, trust-heavy listing comparison copy, cookie/legal-relevant copy, FAQ, SEO, and marketing longcopy are Payload-owned content areas where they carry editorial, SEO, trust, or conversion weight.
- Clinic- or doctor-supplied profile text is still CMS-driven content. The operational submission and review process is deferred, but the localization model must not treat supplier-provided text as Product UI Copy.

## Current Repository Facts

- Payload localization currently supports `en` and `de` with `en` as the default locale and fallback enabled.
- The current localized rollout is limited to `pages` and `posts`.
- Current localized fields are `pages.title`, `pages.layout`, `pages.meta.title`, `pages.meta.description`, `posts.title`, `posts.content`, `posts.excerpt`, `posts.meta.title`, and `posts.meta.description`.
- Current shared fields include `slug`, `publishedAt`, `_status`, media relations, taxonomy relations, author relations, and related-post relations.
- Public routes currently remain default-locale-oriented with no localized slugs, no `/de/...` routes, and no locale-specific sitemap outputs.
- Seed import already supports localized field updates through `localizedFields`.
- The new planning target intentionally differs from the current repository state: the implementation must migrate the existing `en` default pilot toward a `de` default/source model and replace shared publish-only readiness for localized public models with verified per-locale readiness.

## Seed Migration Rules

- Baseline and demo seeds should write German values as the default/source locale for localized fields.
- Existing English seed, pilot, and CMS-owned copy should be carried into the corresponding `en` localized values instead of being discarded or overwritten.
- When no German source exists yet, the initial German source value may be translated or adapted from the existing English baseline, but it becomes reviewable German source copy after migration.
- This seed migration rule does not turn English into the canonical source language. It only preserves existing English work while moving the default/source model to German.

## Field Ownership Rules

- Localize editorial, SEO-relevant, trust-relevant, conversion-relevant, and domain-specific text fields.
- Keep stable IDs, technical IDs, ownership fields, access fields, audit fields, status fields, ratings, prices, calculated values, and analytics-relevant identity shared.
- Keep relationships shared unless a model has a concrete language-specific relationship need.
- Keep proper names and identity values shared, including clinic names, doctor names, team member names, testimonial author names, acronyms, brand names, and service names.
- Keep pricing, rating, currency, and market values shared. Localize billing labels, plan copy, highlights, descriptions, and CTA text when they are editorially or conversion relevant.
- Keep media file relationships shared. Generic media alt text can be localized on the media asset; context-specific alt text, captions, and descriptions belong to the referencing content.
- Localize link labels. Keep internal references, link type, `newTab`, and appearance shared. Localize custom URLs only when a locale has a real locale-specific target.
- Treat static-route marketing content as Payload-owned content when it has SEO, trust, conversion, or editorial weight.

## Field Matrix

- Existing `Pages` and `Posts`: keep the current localized content and SEO fields. Add localized slugs using the ADR route, canonical, redirect, `hreflang`, and sitemap behavior.
- Taxonomy collections: localize `Treatments.name`, `Treatments.description`, `MedicalSpecialties.name`, `MedicalSpecialties.description`, `Categories.title`, `Tags.name`, relevant public `Accreditation.name`, `Accreditation.description`, `Accreditation.country`, `Countries.name`, country language display text, and `Cities.name`. Keep IDs, ISO codes, currency codes, coordinates, icon keys, media relations, joins, and relationships shared.
- Globals: localize Header and Footer link labels; localize CookieConsent public copy; localize LandingPages SEO, hero, section intro, FAQ, feature, process, CTA, pricing copy, team roles, testimonial quotes, and testimonial roles. Keep images, socials, flags, identities, and layout/technical options shared.
- Clinics and Doctors: localize clinic descriptions, doctor biographies, public profile narrative fields, SEO fields, and future localized slugs. Keep clinic names, doctor names, address, contact details, status, verification, supported languages, relations, prices, ratings, and calculated values shared.
- Clinic gallery: localize story titles, story descriptions, and context-specific media text. Keep media references, owner fields, status, publish metadata, and audit fields shared.

## Readiness And Review

- The first rollout uses Payload per-locale Draft/Publish via `localizeStatus` for models that are localized and publicly/indexably used.
- No Payload Admin translation dashboard is required in phase 1.
- Translation completeness remains visible through CI or script report output plus documentation tables so missing English content does not hide behind fallback.
- Public locale readiness is technical and content-driven: the route document and all visible localized required dependencies must be ready and published in the same locale.
- Preview and Admin Review must visibly distinguish real localized content from fallback content through a visible badge, metadata, or report output.
- Public indexable routes must not render visible fallback-only localized content. If a visible required dependency is not ready in the requested locale, the route is treated as not ready.
- The non-technical ownership process for who can approve Product, SEO, Legal, Trust, or medical content still belongs in the ADR and operating guidance.

## Implementation Dependencies

- Implementation must verify Payload `localizeStatus` behavior in the installed Payload version before relying on it for public readiness.
- If `localizeStatus` is unverified or broken, implementation blocks and the ADR decision must be reopened instead of replaced with heuristic-only readiness.
- Route, metadata, sitemap, redirect, preview, and fallback tests must reflect the ADR decisions before localized slug implementation starts.

ADR-level routing, SEO, fallback, preview, and indexing decisions that affect this item are tracked in [Localization ADR decision backlog](./localization-adr-questions.md).

## Evidence To Check Before Issue Creation

- Review current localized fields from the Pages and Posts pilot.
- Inventory collection and global fields with public rendering impact across all Payload-owned content models.
- Identify routes where Payload content already appears in public UI.
- Check seed data paths and import behavior for localized fields.
- Confirm current fallback and publish-status behavior from Payload configuration.
- Verify Payload `localizeStatus` behavior and test coverage before using it as a public readiness gate.

## Draft Acceptance Shape

- Content ownership boundaries are documented with examples.
- All Payload-owned editorial, SEO-relevant, and domain-specific content models are inventoried and prioritized.
- Localized versus shared field decisions exist for every covered content model.
- Implementation sequencing is documented without reducing the final model coverage requirement.
- The current `en` default pilot has a documented migration path to the `de` default/source target.
- Existing English seed and pilot content is preserved as `en` alternative-locale content during the `de` source reset.
- Localized slugs are planned for all public models, with implementation sequencing and tests following the ADR public URL behavior.
- Locale readiness is driven by verified per-locale publish status for localized public models.
- English indexable routes are blocked when route content or visible localized required dependencies are not ready in English.
- Visible German fallback never appears on indexable English routes.
- Each implemented rollout includes migrations, type generation, seeds, and tests.
- Editorial fallback and completeness behavior are documented.
- Follow-up issues exist only where concrete future work remains.
