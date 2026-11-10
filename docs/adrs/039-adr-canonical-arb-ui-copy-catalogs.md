# ADR: Canonical ARB catalogs for Product UI Copy

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 06.11.2026         |
| Status  | accepted           |

## Background

[ADR 021](./021-adr-localization-source-ownership-and-readiness-governance.md) requires a Git-backed, vendor-neutral source for Product UI Copy using ICU-compatible messages and translation metadata. It does not select a catalog file format. [ADR 038](./038-adr-native-payload-locale-publication.md) retains that requirement while keeping CMS publication native to Payload.

findmydoc needs a defined catalog format that carries translator context and can later move to a managed translation platform without a project-specific metadata schema.

## Considerations

1. JSON messages with separate metadata files.
   - Simple to start, but requires findmydoc to define a metadata schema and map it into future translation tools.
2. XLIFF as the canonical catalog.
   - Provides a standardized translation interchange format, but requires choosing a version and processing profile before a target platform or translation workflow needs it.
3. Application Resource Bundle, ARB, with predefined metadata, chosen.
   - Keeps messages and translator context together in an existing JSON-based format with ICU message support.

## Decision with Rationale

ARB is the canonical file format for Product UI Copy. Store source messages and translations in `.arb` files in Git, using ICU MessageFormat for placeholders, plurals, and selects. German remains the phase-1 source language and English the first alternative.

Use only predefined ARB metadata. This includes `@@locale`, per-message attribute entries such as `@messageId`, descriptions, context, and placeholder descriptions and examples. Do not add custom attributes, `x-` extensions, project-specific `sourceHash` fields, or custom review and approval states. Separate metadata files are not part of the canonical catalog.

Repository history and PR review preserve source changes. Assignments and translation-review workflows belong to a managed translation platform when one is adopted, rather than to new ARB fields. Runtime message files may be generated for an application's library, but remain derived artifacts; they do not define a second canonical format.

XLIFF remains a documented option for future interchange with translation platforms or service providers. This decision requires no XLIFF importer, exporter, or migration tool. Choose the supported XLIFF version and profile only when a concrete integration needs them. A migration tool may be developed then; verify preservation of message keys, texts, descriptions, and placeholder/plural semantics against that target.

## Scope and Relationship to Earlier Decisions

This ADR specifies the previously open catalog format within ADR 021's ICU-and-metadata requirement. It supplements ADR 021 and ADR 038 without rewriting their closed decision records.

- Product UI Copy remains separate from Payload CMS Content.
- Payload-native language publication and the removal of aggregate completeness gates from ADR 038 remain in force.
- Payload Admin navigation, labels, and helper text remain English.
- Git and PR review remain the phase-1 workflow. This ADR does not choose a repository name, package layout, web runtime, or translation-platform vendor.

## Consequences and Technical Debt

findmydoc uses an existing catalog specification and avoids maintaining a custom metadata dialect. ARB support in a translation platform does not guarantee preservation of every predefined attribute; a future integration must check the attributes it uses during import and export.

Catalog extraction, application adapters, and any later platform migration remain implementation work. This decision changes no runtime code and introduces no conversion tooling.

## References

- [ARB specification](https://github.com/google/app-resource-bundle/blob/main/docs/specification.md)
- [Lokalise ARB support and metadata mappings](https://docs.lokalise.com/en/articles/5042246-application-resource-bundle-arb)
- [Phrase Strings ARB support](https://support.phrase.com/hc/en-us/articles/6111361660188--ARB-Application-Resource-Bundle-Strings)
- [XLIFF 2.0 specification, interchange reference only](https://docs.oasis-open.org/xliff/xliff-core/v2.0/os/xliff-core-v2.0-os.html)

## Superseded by (Optional)

Not superseded.
