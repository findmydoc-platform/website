# ADR: Native Payload Locale Publication Without Aggregate Readiness Gates

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 06.11.2026         |
| Status  | accepted           |

## Background

[ADR 018](./018-adr-native-payload-localization-strategy.md) establishes native Payload localization. [ADR 021](./021-adr-localization-source-ownership-and-readiness-governance.md) adds an aggregate public-readiness requirement across Product UI Copy and every visible required localized content dependency. [ADR 022](./022-adr-public-localization-routing-seo-and-domain-strategy.md) consumes that requirement for public routes and SEO signals.

Payload 3.90.2 already supports publishing a selected locale and tracking draft/published status per locale. findmydoc keeps publication within those native capabilities and removes the additional aggregate completeness requirement.

## Problem Description

An aggregate readiness check would couple publication of one content document to the translation state of UI messages and related content. It would require findmydoc to define and maintain an additional publication condition across separate content owners before delivering the first usable localized experience.

## Considerations

1. Retain the aggregate readiness check from ADR 021.
   - It provides an explicit completeness gate, but adds cross-content rules and a separate condition beyond Payload publication.
2. Use selected-locale publication with a shared document status.
   - It supports publishing one locale's changes, but does not provide an independent draft/published status for each locale.
3. Use native selected-locale publication and localized status without an aggregate readiness check, chosen.
   - It preserves independent language publication while keeping the publication model inside Payload.

## Decision with Rationale

Payload owns the draft/published state of each localized content document. Use native localized status, enabled through `experimental.localizeStatus` and the relevant collection or global's `versions.drafts.localizeStatus`. Use `localization.defaultLocalePublishOption: 'active'` so the default Admin publish action targets the active locale. Native explicit publication of all locales remains a separate action.

Publishing German must leave an English draft unpublished. findmydoc does not introduce a parallel approval state, custom readiness field, or replacement publication workflow. Focused integration checks verify the configured native behavior and public access rules; they do not calculate translation completeness.

Public locale availability follows the requested content document's native publication status in that locale. It does not depend on a scan of UI messages, source hashes, translation-review metadata, or related documents. There is no aggregate completeness report or dependency traversal that blocks publication, public routing, sitemap inclusion, alternate links, or the language switcher.

Public content reads request the selected locale with fallback disabled and retain the applicable published-content access rules. Draft related content remains subject to its own access rules. Missing translated fields or UI messages do not create another readiness state or automatically unpublish the document. Native field validation and editorial responsibility still apply.

For ADR 022, replace the aggregate readiness condition with native publication in the requested locale. Published equivalents may participate in canonical, sitemap, `hreflang`, alternate-link, and switcher behavior. An existing source route whose requested alternative locale is unpublished keeps the translation-unavailable response specified in ADR 022, including `noindex` and exclusion from discovery signals. Missing UI copy or a related translation does not independently trigger that response.

Payload Admin navigation, labels, and helper text remain English. Translating the Admin menu is outside this rollout.

## Scope and Relationship to Earlier Decisions

This ADR supersedes only the aggregate publication-readiness and fallback-completeness requirements in ADR 021 and their use as a public-routing and SEO condition in ADR 022. The following decisions remain in force:

- German is the phase-1 source/default language; English is the first alternative. Turkish remains future backlog.
- Existing English content is preserved during migration to German as the source/default language.
- Product UI Copy remains separate from Payload Content and English-only Payload Admin text.
- Product UI Copy uses a Git-backed, vendor-neutral source with ICU-compatible messages and translation metadata.
- ADR 022's URL, domain, canonical, redirect, preview, and translation-unavailable response rules continue to apply with the publication condition defined here.
- Locale-aware cache and revalidation requirements remain unchanged.

This decision does not choose the UI Copy repository, package layout, web runtime, or catalog validation tooling. It does not implement runtime, schema, seed, or data migration changes.

## Consequences and Technical Debt

Editors control language publication through Payload's native actions. Publication no longer proves that all UI messages and related content have translations. Editors remain responsible for reviewing the visible result before publication.

The runtime still requires the planned locale and content migration. Enabling localized status requires the repository's Payload migration workflow and deliberate preservation of existing publication states. Payload documents localized status as experimental in the installed version; verify the configured publish and read paths before public use.

## References

- [Payload localization and localized status](https://payloadcms.com/docs/configuration/localization#status-localization)
- [Payload 3.90.2 default locale publication option](https://github.com/payloadcms/payload/blob/v3.90.2/packages/payload/src/config/types.ts#L532)
- [Payload 3.90.2 selected-locale publication coverage](https://github.com/payloadcms/payload/blob/v3.90.2/test/versions/int.spec.ts#L4825)

## Superseded by (Optional)

Not superseded.
