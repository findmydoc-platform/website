# Architecture Decision Records (ADR)

This repository contains the Architecture Decision Records (ADRs) for the project. Each ADR documents an important architectural decision that was made, including the context, alternatives, decision criteria, and final rationale.

## Repository Structure

- **/adr/**: The main folder where all ADRs are stored.
- **/adr/000x-decision-title.md**: Each ADR is numbered sequentially and includes a descriptive title.
- **/archive/**: Deprecated or rejected ADRs are moved here to keep the main folder clean.
- **/templates/**: This folder contains the template to create new ADRs.

## How to Create a New ADR

1. Create a new file in the `/adr` directory with the next sequential number (e.g., `0004-new-decision.md`).
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

## Purpose of ADRs

Architecture Decision Records serve as a log of important technical and architectural decisions made throughout the lifecycle of the project. They help ensure decisions are documented and accessible for future reference.

## Contributing

When adding a new ADR:
- Ensure to provide enough detail in the **Considerations** section about the evaluated alternatives and why some were discarded.
- Always include rationale in the **Decision** section to explain why the final decision was made.
- Update any deprecated or superseded ADRs with links to the new decisions.

## References

- [ADR GitHub Template](https://github.com/joelparkerhenderson/architecture_decision_record)
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
