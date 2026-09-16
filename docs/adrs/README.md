# Architecture Decision Records (ADR)

This repository contains the Architecture Decision Records (ADRs) for the project. Each ADR documents an important architectural decision that was made, including the context, alternatives, decision criteria, and final rationale.

## Repository Structure

- **/docs/adrs/**: The main folder where all ADRs are stored.
- **/docs/adrs/NNN-decision-title.md**: Each ADR is numbered sequentially and includes a descriptive title.
- **/docs/adrs/archive/**: Reserved for legacy archived records. Do not move new closed ADRs from their stable paths.
- **/docs/adrs/templates/**: This folder contains the template to create new ADRs.

## How to Create a New ADR

1. Create a new file in the `/docs/adrs` directory with the next sequential number (for example, `028-new-decision.md`).
2. Follow the structure used in previous ADRs, ensuring it includes:
   - Background
   - Problem Description
   - Considerations (alternatives and evaluation criteria)
   - Final Decision with rationale
   - Technical Debt (if any)
   - Risks (optional)
   - Deprecated or Superseded sections (if applicable)
3. If the ADR supersedes an earlier one, make sure to reference the older ADR in the **Superseded by** section of the older ADR.

## ADR Status

Each ADR can have one of the following statuses:

- **Draft**: The ADR is under review and not yet finalized.
- **Approved**: The ADR has been reviewed and accepted.
- **Rejected**: The ADR was reviewed but not accepted.
- **Deprecated**: The ADR is outdated or has been replaced by another decision.
- **Superseded**: The ADR has been replaced by a newer decision, which is referenced.

## Lifecycle and Immutability

Only a **Draft** ADR may be revised. Once an ADR is **Approved**, **Rejected**, **Deprecated**, or **Superseded**, it is closed and its decision record is immutable. Do not rewrite its context, decision, rationale, consequences, scope, or historical evidence.

If a closed decision changes, create a new sequential ADR. The new ADR must identify the record it supersedes, while the old ADR may receive only the lifecycle metadata needed to set its status to **Deprecated** or **Superseded** and link to the replacement. Keep both records in version control.

Corrections and clarifications that would alter the meaning of a closed ADR also require a new ADR. Historical in-place revisions remain historical exceptions and do not authorize further edits.

Treat any revisit or update wording inside a closed ADR as a trigger for a successor, not as permission to edit the closed record.

## Purpose of ADRs

Architecture Decision Records serve as a log of important technical and architectural decisions made throughout the lifecycle of the project. They help ensure decisions are documented and accessible for future reference.

## Contributing

When adding a new ADR:

- Ensure to provide enough detail in the **Considerations** section about the evaluated alternatives and why some were discarded.
- Always include rationale in the **Decision** section to explain why the final decision was made.
- Limit changes to a deprecated or superseded ADR to its status and replacement link.

## References

- [ADR GitHub Template](https://github.com/joelparkerhenderson/architecture_decision_record)
- [Semantic Anchors: ADR according to Nygard](https://llm-coding.github.io/Semantic-Anchors/anchor/adr-according-to-nygard/)
- [ADRs: Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

## ADR Index

- [001 — Technology stack: Web + React + PayloadCMS](./001-adr-technology-stack-web-react-payloadcms.md)
- [002 — Auth provider: PayloadCMS + Supabase vs Firebase](./002-adr-auth-provider-payloadcms-supabase-firebase.md)
- [003 — API layer: GraphQL vs Server Actions](./003-adr-api-layer-graphql-vs-server-actions.md)
- [004 — Custom authentication strategy: Supabase + PayloadCMS](./004-adr-custom-authentication-strategy-supabase-payloadcms.md)
- [005 — Repository visibility: public vs private](./005-adr-repository-visibility-public-vs-private.md)
- [006 — Supabase + PayloadCMS multi-user auth strategy](./006-adr-supabase-payloadcms-multi-user-auth-strategy.md)
- [007 — Testing framework selection](./007-adr-testing-framework-selection-payloadcms.md)
- [008 — Styling architecture: CVA over @apply](./008-adr-styling-architecture-cva-over-apply.md)
- [009 — Animation stack: landing storytelling](./009-adr-animation-stack-landing-storytelling.md)
- [010 — Structured logging approach](./010-structured-logging-approach.md)
- [011 — Parent-controlled components for interactive UI](./011-adr-parent-controlled-components.md)
- [012 — Enforce code formatting with Prettier and CI gate](./012-adr-code-formatting-prettier-and-ci.md)
- [013 — Storybook documentation location](./013-adr-storybook-documentation-location.md)
- [014 — AI anti-slop quality gates and lane strategy](./014-adr-ai-anti-slop-quality-gates.md)
- [015 — Consolidated Seed Runner and Dashboard Job Queue](./015-adr-seed-runner-and-manual-seed-pipeline.md) _(versioned, current v2.0)_
- [016 — Domain DNS control plane and registrar strategy](./016-adr-domain-dns-control-plane-and-registrar-strategy.md)
- [017 — Payload virtual fields pilot for post author projection](./017-adr-payload-virtual-fields-post-populated-authors.md)
- [018 — Native Payload CMS localization strategy](./018-adr-native-payload-localization-strategy.md)
- [019 — PostHog event taxonomy and usage governance](./019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [020 — Database migration quality gate](./020-adr-database-migration-quality-gate.md)
- [021 — Localization source, ownership, and readiness governance](./021-adr-localization-source-ownership-and-readiness-governance.md)
- [022 — Public localization routing, SEO, and domain strategy](./022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [023 — Public website cache and revalidation strategy](./023-adr-public-website-cache-and-revalidation-strategy.md)
- [024 — Production build webpack fallback](./024-adr-production-build-webpack-fallback.md)
- [025 — Direct staff authentication collections](./025-adr-direct-staff-auth-collections.md)
- [026 — Standalone Clinic Dashboard BFF architecture](./026-adr-standalone-clinic-dashboard-bff-architecture.md)
- [027 — Database runtime connection modes](./027-adr-database-runtime-connection-modes.md)
- [028 — Lettermint for transactional email](./028-adr-lettermint-for-transactional-email.md)
