# Product UI Copy Localization Item

## Working Title

Product UI copy needs a Git-backed localization source before UI strings spread across clients.

## Problem Statement

findmydoc needs a clear source of truth for product UI copy such as buttons, labels, validation messages, empty states, filters, tabs, table headers, and generic product microcopy. Without this, UI strings will drift across web components, future mobile clients, and ad hoc JSON files.

The current risk is not only missing translations. The larger risk is creating a translation source that is too app-specific, too nested, or too light on metadata to migrate later to a managed TMS.

## Intended Outcome

Product UI copy is managed through a canonical, Git-backed localization source in a dedicated Product UI Copy repository. That source can generate runtime files for the web app and later support a managed TMS migration.

The implementation should keep Git as the source of truth while avoiding a bespoke translation platform that becomes expensive to replace. The website repository consumes a generated package or artifact rather than becoming the canonical copy repository.

## Counter-Position

This item should be challenged hard before implementation. A Git-backed translation system can become internal platform work before findmydoc has enough product UI copy, active locales, or translation throughput to justify it.

The first version may need only a disciplined source format and validation, not a Payload-backed translation UI, mobile export pipeline, or TMS-like workflow. If the current product surface is still changing heavily, premature key governance can slow down basic iteration.

## Scope

This item covers:

- Product web UI copy for auth, forms, listing/comparison, clinic detail, favorites/account, navigation, and generic UI primitives.
- Stable key naming and namespace rules.
- Canonical locale model using BCP 47 language tags.
- ICU MessageFormat for placeholders, pluralization, and selects.
- Minimal metadata for translator context and stale-translation detection.
- CI validation for broken or stale translation units.
- Deterministic export into web runtime files.
- PR-based review flow for translation changes.

This item does not cover:

- Payload CMS editorial content.
- SEO page copy, landing page content, clinic profiles, or blog content.
- Payload admin collection and field labels.
- Immediate adoption of Lokalise, Crowdin, or Phrase.
- Mobile OTA delivery unless product UI copy already has a concrete mobile consumer.

## Resolved Decisions

- Phase-1 locales are `de` and `en`.
- Locale IDs use BCP 47 tags and stay regionless by default unless a real regional distinction appears.
- `de` is the source language because the initial public product focus is the DACH region.
- `en` is the first alternative language for international users, partners, and later expansion.
- `tr` is not part of the first implementation.
- Existing English UI strings are migration input and must be carried into the `en` target catalog when Product UI Copy is extracted.
- Initial German source copy may be translated or adapted from the captured English baseline, then reviewed and corrected as German source copy. This preserves existing English work without making English the canonical source language.
- Runtime messages use ICU MessageFormat.
- The canonical source uses ICU-compatible JSON plus metadata files in Git.
- The localization ADR decides the web i18n runtime. `next-intl` is the preferred working default for the Next.js App Router consumer unless the ADR decides otherwise.
- The phase-1 workflow is Git plus PR review, not Payload Admin UI and not an external TMS.
- The dedicated Product UI Copy repository is the source of truth. Its concrete repository name is intentionally undecided at this planning level.
- The website consumes Product UI Copy through a generated package or artifact, with generated web runtime integration planned for the source i18n area.
- Engineering owns schema, key structure, CI, and integration.
- Founder/Product reviews source copy and translations.
- The first implementation uses domain namespaces such as `auth`, `forms`, `clinicComparison`, `clinicDetail`, `favorites`, `navigation`, and `common`.
- The first migration slice and hard-coded string checker baseline is `auth` plus forms.
- The metadata set is intentionally minimal and TMS-ready: `description`, `namespace`, `sourceHash`, `placeholders`, and optional `routeContext`.
- Screenshot context, owner matrices, review status workflows, and XLIFF import/export are out of scope for phase 1.
- Missing `en` translations remain absent from source files and are surfaced through a deterministic PR/CI report during phase 1.
- `sourceHash` is script-owned. CI or the source-management script recalculates hashes, and stale `en` translations are released only when the target text changes or explicit review metadata allows it.
- Hard-coded Product Web strings use a migration-gated policy: warn while an area is being migrated, then block new user-facing hard-coded strings for migrated areas.
- Hard-coded string detection uses an AST or ESLint-style checker for migrated files, including TSX text nodes, relevant accessibility labels, placeholders, titles, and validation messages.
- Explicit exceptions are allowed for tests, Storybook, Developer/Admin-only surfaces, logs, technical IDs, brand names, and external service names.
- Technical English terms, brand names, and common product vocabulary stay in German source copy only when they are approved through a glossary allowlist.
- Temporary Landing copy is split by ownership: reusable controls, form labels, validation, and switcher microcopy belong to Product UI Copy; H1, SEO metadata, marketing longcopy, FAQ, trust, and conversion copy belong to Payload Content Localization.
- External TMS adoption is reassessed when there are more than three active locales, regular external translators, or recurring translation PR conflicts.

## Implementation Shape

Source files in the dedicated Product UI Copy repository should remain Git-friendly and reviewable. XLIFF is treated as a future interchange format for TMS migration, not as the primary hand-edited format.

The initial extraction should capture existing English UI strings before replacing hard-coded copy. Those captured values become the `en` target catalog. German source entries can then be translated or adapted from the captured English baseline and reviewed as the new source copy.

Example source message file:

```json
{
  "auth.signIn.submit": "Anmelden",
  "clinicComparison.filters.clear": "Filter zurücksetzen",
  "clinicComparison.results.count": "{count, plural, one {# Klinik gefunden} other {# Kliniken gefunden}}"
}
```

Example metadata file:

```json
{
  "auth.signIn.submit": {
    "description": "Primary submit button on patient and staff login forms.",
    "namespace": "auth",
    "placeholders": [],
    "sourceHash": "sha256:..."
  },
  "clinicComparison.results.count": {
    "description": "Result count above the clinic comparison list.",
    "namespace": "clinicComparison",
    "placeholders": ["count"],
    "routeContext": "/listing-comparison",
    "sourceHash": "sha256:..."
  }
}
```

Runtime export should be deterministic and should not make the selected web library the canonical source model. If the ADR selects `next-intl`, the implementation can generate or expose compatible message files from the canonical source. The website-side consumer should place generated web runtime files or the package adapter in the source i18n area once that area exists.

## CI And Governance

- Validate message schema, duplicate keys, locale files, namespace conventions, ICU syntax, placeholder consistency, and source hashes.
- Warn on missing target translations for `en` during the first implementation through generated report output instead of placeholder values in source files.
- Block stale translations when `sourceHash` proves that the German source changed without target review.
- Track migration coverage per Product Web area so hard-coded string checks can move from warning to blocking once an area is migrated.
- Block new hard-coded user-facing strings only in migrated areas, starting with `auth` plus forms.
- Keep source-language and translation changes reviewable through ordinary PRs.

ADR-level decisions that affect this item are tracked in [Localization ADR decision backlog](./localization-adr-questions.md).

## Evidence To Check Before Issue Creation

- The current repository has no installed general-purpose web i18n library such as `next-intl`, `i18next`, `react-i18next`, or `next-i18next`.
- The temporary landing mode already carries `en`, `de`, and `tr` copy through a custom feature-local structure, but `tr` is no longer part of the phase-1 localization plan.
- Public product surfaces contain hard-coded user-facing strings in auth, listing/comparison, clinic detail, forms, navigation, and generic UI components.
- Existing validation messages are distributed across form implementations and are not yet a single product-copy source.
- Mobile is not a concrete phase-1 consumer; the source format should stay migration-ready without building mobile delivery.

## Standards References

- [W3C Language Tags](https://www.w3.org/International/articles/language-tags/) for BCP 47 locale identifiers.
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) for placeholders, plurals, and selects.
- [Unicode MessageFormat 2](https://messageformat.unicode.org/) as a relevant future standard, not a phase-1 runtime requirement.
- [OASIS XLIFF 2.1](https://docs.oasis-open.org/xliff/xliff-core/v2.1/xliff-core-v2.1.html) as the future interchange format reference.
- [Next.js Internationalization](https://nextjs.org/docs/app/guides/internationalization) for App Router routing context.
- [next-intl App Router](https://next-intl.dev/docs/getting-started/app-router) as the preferred working default for the web runtime unless the ADR decides otherwise.

## Draft Acceptance Shape

- Product UI copy ownership is documented with examples and counterexamples.
- A canonical source format is chosen and documented.
- Runtime export rules exist for the ADR-selected web consumer.
- CI validates keys, locales, placeholders, ICU syntax, and stale translations.
- Missing `en` translations warn during phase 1.
- Existing English UI strings are preserved in the `en` target catalog when migrated into Product UI Copy.
- Migrated Product Web areas block new hard-coded user-facing strings.
- A PR review flow exists for translation changes.
- A future managed TMS migration path is documented without implementing the migration.
