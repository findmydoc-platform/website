# ADR: Shared UI Copy source, delivery, and fallback

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 08.11.2026         |
| Status  | accepted           |

## Background

[ADR 039](./039-adr-canonical-arb-ui-copy-catalogs.md) selects ARB with predefined metadata as the canonical Product UI Copy format. It leaves the source repository and application integration open. [ADR 038](./038-adr-native-payload-locale-publication.md) keeps CMS locale publication native to Payload and removes aggregate completeness gates.

The applications need a clear source for shared interface wording and a readable result when a target-language UI message is missing.

## Considerations

- Keeping canonical copies in each application makes independent changes easy but allows shared wording to diverge.
- A dedicated shared catalog repository gives Product UI Copy one canonical source and separates translation changes from application code.
- Exposing missing-message keys makes gaps visible to users; falling back to the source message keeps generic interactions readable.
- Fetching current messages at runtime allows independent copy changes but makes the deployed text version less explicit. A pinned package keeps text adoption within the application's normal update and deployment flow.
- Preparing bundles in the package build makes the export and fallback result explicit in a versioned artifact. Preparing them per request would repeat conversion work and couple request handling to catalog structure.
- Allowing library calls throughout reusable UI makes a future library change affect more components. Keeping translation composition at application boundaries reduces that dependency without requiring a general translation abstraction.
- A custom release or dependency-update bot would duplicate established tools. Release Please handles package versioning and release preparation, GitHub Actions publishes the package, and Dependabot proposes consumer updates.

## Decision with Rationale

The dedicated repository `findmydoc-platform/ui-copy` is the single canonical source for the applications' ARB catalogs and publishes the package `@findmydoc-platform/ui-copy`. The Website consumes ready-to-use `next-intl` message bundles produced during the Copy package build rather than maintaining separate canonical copies. The repository contains the catalog and the necessary validation or artifact generation, without a custom translation interface.

Applications use an exact version of the Copy package. Publishing a catalog package does not change a deployed application by itself. An application adopts new wording through a reviewed package-version update and its next normal deployment. The browser does not fetch the latest catalog from the source repository or a separate translation service at runtime.

Use Release Please and GitHub Actions for Copy package releases, and Dependabot for application dependency updates. Release Please prepares a release PR with the package version and changelog from Conventional Commits. Merging the approved release PR creates the release and triggers package validation, build, and publication through GitHub Actions. Dependabot proposes the corresponding application dependency and lockfile updates on its configured schedule. Neither package publication nor an update proposal bypasses reviewed application adoption or the application's normal deployment.

These tools keep release preparation, package publication, and consumer adoption separate without a custom release or update bot. The release PR is an explicit package-release approval step and can group multiple copy changes. Application maintainers retain control over when a released catalog version reaches users.

Dependabot checks for Copy package updates once a week and proposes them separately from unrelated dependency changes. Do not add an age-based delay for this package on top of the weekly check. Urgent updates may be made through a reviewed manual package-version and lockfile change before the next scheduled run. The weekly cadence limits routine update traffic while preserving that urgent path.

The baseline does not rely on package-release events starting native Dependabot jobs. GitHub documents scheduled and manual version-update checks, but no native package-release trigger or public REST endpoint for starting such a job. An event-driven consumer update would require separate Actions automation; that additional mechanism is not selected here.

German remains the source language. If a generic English UI message is missing, copy the existing German source message into the English runtime bundle during the Copy package build. Duplicated German text in the English bundle is acceptable. The requested route and locale remain unchanged; an English screen may therefore contain an individual German control or form message. Missing target messages are visible through developer diagnostics during maintenance.

Numbers, dates, and other locale-sensitive ICU values use the requested UI locale even when the message text came from German fallback. An English screen therefore keeps English formatting conventions inside an individual German fallback message. There is no separate formatter selected from each message's source language.

Every message key used by a migrated UI area must have a usable German source message. A missing German source fails pre-deployment validation or the build because the agreed fallback cannot be resolved. A missing English target remains a diagnostic with German fallback. This checks UI catalog integrity and does not restore the removed completeness check over CMS content or public routes.

This fallback applies only to Product UI Copy. It does not introduce fallback for editorial, marketing, legal, medical, or other Payload-owned content. The content-read rules from ADR 038 and English-only Admin wording remain in force.

ARB metadata remains limited to the predefined attributes from ADR 039. Repository ownership and fallback do not require custom catalog attributes or a new public-readiness state.

## Package-build preparation

The Copy package build prepares the runtime bundles before delivery:

- Keep the standard ARB metadata in the canonical source files and omit it from the runtime messages passed to `next-intl`.
- If source keys contain dots, generate the nested message structure required by `next-intl`. Keys without dots do not need that transformation.
- Identify missing English original entries before filling those entries with existing German source messages.
- Produce English runtime bundles with those German fallbacks already included.

This process transforms data and copies existing source messages. It does not translate text or generate new English wording.

At server or browser request time, there is no ARB conversion, key restructuring, or fallback-catalog merge. Loading the appropriate prepared bundle, looking up messages, and evaluating dynamic ICU arguments such as names, numbers, and plural forms remain runtime behavior.

This boundary keeps conversion rules in the package exporter and makes the prepared message set reproducible for a given package version. The trade-off is that fallback text is duplicated in target bundles and every copy change still requires a package update and application deployment. Those costs are accepted in exchange for explicit delivery and simpler request handling.

## Web library and replaceability

`next-intl` is the Website's translation library. ARB remains the library-independent canonical format; `next-intl` does not define the source catalog schema.

Replacing the Web library later should mainly affect the runtime export and Website integration. The standardized ARB catalogs, stable message keys, and existing translations remain reusable. A library change must not require translating the entire catalog again merely because the integration changes.

Keep the established URL and locale rules independent of the Web library. Central configuration and bundle loading own the library setup. Page and feature adapters compose translated wording with `next-intl` and pass finished text to reusable UI. Reusable buttons, form fields, and similar components do not call `next-intl`; client-side dynamic wording is composed in the owning feature adapter.

This keeps library-specific calls out of reusable UI contracts and preserves their isolated rendering and testing. A future Web library change can focus on export, configuration, and the application adapters instead of replacing translation dependencies throughout generic components. This decision calls for neither a custom translation engine nor a speculative general-purpose i18n abstraction.

## Technical consequences

The chosen build boundary means missing English entries must be diagnosed before fallback insertion, because the prepared bundle no longer exposes those gaps. Structural key collisions, such as using both `auth` as a message and `auth.submit` as a nested message, cannot be exported safely and must be rejected rather than overwriting a message. Export preserves ICU messages and placeholder semantics. Generated bundles are derived artifacts and are not edited manually.

These are consequences of the format and compilation boundary, not additional editorial approval states or public completeness gates.

## Scope

This decision records source ownership and naming, exact-version delivery, package-build preparation, generic UI fallback and formatting, the choice of `next-intl` with an explicit integration boundary, and release automation through Release Please, GitHub Actions, and weekly Dependabot checks. Detailed migration slices remain implementation planning rather than part of the catalog architecture.

The first integrated localization rollout is accepted in Preview. Production activation follows through the normal joint platform release process after that acceptance.

Named responsibilities for Preview acceptance are deliberately deferred to a later coordination step. This ADR assigns no person to technical or editorial acceptance.

## Consequences

Shared wording has one authoring source and an explicit version in each application. Copy changes require an application update and deployment to reach users. Missing English interface text can temporarily produce a mixed-language screen without making the page unavailable; an unusable German source is caught before delivery. Editorial content retains its separate language-publication rules.

No repository, package, runtime integration, or deployment is created by this decision record.

## References

- [next-intl message structure and ICU messages](https://next-intl.dev/docs/usage/translations)
- [next-intl request configuration and fallback behavior](https://next-intl.dev/docs/usage/configuration)
- [next-intl Server and Client Components](https://next-intl.dev/docs/environments/server-client-components)
- [Release Please release preparation](https://github.com/googleapis/release-please-action#how-release-please-works)
- [Release Please package publication in GitHub Actions](https://github.com/googleapis/release-please-action#automating-publication-to-npm)
- [Dependabot update configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [Manually rerunning Dependabot jobs](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/re-run-dependabot-jobs)
- [Public Dependabot REST API](https://docs.github.com/en/rest/dependabot)
