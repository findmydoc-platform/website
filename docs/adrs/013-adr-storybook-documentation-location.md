# ADR: Storybook Documentation Location

## Status (Table)

| Name | Content |
| --- | --- |
| Author | findmydoc team |
| Version | 1.0 |
| Date | 02.02.2026 |
| Status | approved |

## Background

The repository relies on Storybook for UI coverage, but there is no single, consistent decision about where documentation for stories should live. This leads to mixed expectations about whether documentation belongs inside stories, in Storybook MDX pages, or in repository-wide docs.

## Problem Description

We need a clear, repository-specific decision that defines the primary location for Storybook documentation and clarifies when additional documentation is required. The guidance should align with the existing Storybook usage in this repo and avoid duplication or drift.

## Considerations

### Option A: Autodocs-first documentation in story files

Storybook recommends Autodocs as the default for component documentation and encourages keeping docs in sync with stories and args for low maintenance. Autodocs makes it easy to keep prop tables, controls, and example stories together (see Storybook Autodocs guidance: https://storybook.js.org/docs/writing-docs/autodocs).

### Option B: MDX docs pages for every component

MDX is ideal for custom layouts, long-form guidance, and narrative documentation (Storybook docs: https://storybook.js.org/docs/writing-docs). However, maintaining MDX for every component increases overhead and risks drifting from story updates.

### Option C: Repository docs as the primary documentation source

Keeping component documentation in repository markdown files makes it harder to keep documentation aligned with actual stories and reduces discoverability inside Storybook.

## Decision with Rationale

We will treat **Storybook story files as the primary source of component documentation**. Autodocs (and short component descriptions inside story metadata) should cover the majority of documentation needs and remain colocated with stories for maintainability and discoverability.

Additional documentation is required only when:

- The guidance is cross-cutting (applies to multiple components or patterns).
- The documentation needs narrative structure beyond what Autodocs can provide.
- The topic is about design guidelines or complex workflows rather than a single component API.

In those cases, use **Storybook MDX docs pages** that live alongside stories, and keep repository-level markdown documents reserved for system-wide decisions and infrastructure guidance (like this ADR).

## Technical Debt

- Existing stories may lack short descriptive metadata. Update descriptions incrementally when touching stories, but do not backfill all stories in one sweep.

## Risks (Optional)

- **Docs fragmentation** if MDX pages are overused. Mitigate by keeping MDX reserved for cross-cutting or narrative documentation.
- **Sparse component notes** if story descriptions are not maintained. Mitigate by updating descriptions as components evolve.
