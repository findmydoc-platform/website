# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the findmydoc platform frontend.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help teams:
- Understand why past decisions were made
- Avoid relitigating settled debates
- Onboard new team members faster
- Maintain consistency across the codebase

## Active ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./001-parent-controlled-components.md) | Prefer Parent-Controlled Components Over Uncontrolled Components | Accepted | 2025-12-14 |

## Creating New ADRs

When making a significant architectural decision:

1. Copy an existing ADR as a template
2. Number it sequentially (e.g., `002-your-decision.md`)
3. Fill in all sections:
   - **Status**: Proposed → Accepted/Rejected/Superseded
   - **Context**: What problem are we solving?
   - **Decision**: What did we decide?
   - **Rationale**: Why did we decide this?
   - **Consequences**: What are the impacts?
4. Submit as part of your PR
5. Update this README with the new ADR

## Statuses

- **Proposed**: Under discussion
- **Accepted**: Decision is final and should be followed
- **Rejected**: Decision was considered but not adopted
- **Superseded**: Replaced by a later ADR (link to the new one)
- **Deprecated**: Still in effect but scheduled for retirement
