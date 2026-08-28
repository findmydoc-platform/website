# Story Governance

This document defines the canonical metadata contract for Storybook stories in this repository.

## Purpose

Story metadata must stay searchable by domain and lifecycle stage while keeping Atomic Design layering explicit.

## Location Contract

- New or changed component stories live beside their documented source component under `src/**`.
- Shared fixtures, shared assets, global MDX guidance, and explicitly story-only prototypes remain under `src/stories/**`.
- Story-only prototypes live under a `prototypes/` directory.
- Untouched legacy component stories under `src/stories/**` remain valid until the component-story colocation refactor is complete.
- An `Internal/...` title does not grant a central-location exception by itself.

## Title Contract

Every story title must use one of these formats:

- `Shared/<Layer>/<ComponentPath>`
- `Domain/<Domain>/<Layer>/<ComponentPath>`
- `Internal/<Domain>/<Layer>/<ComponentPath>`

Use `Internal/...` for launch concepts, prototypes, or other story-only work that should not read as a customer-facing product area.

Allowed `<Layer>` values:

- `Atoms`
- `Molecules`
- `Organisms`
- `Templates`
- `Pages`

## Tag Contract

Every story must include these tags:

- `autodocs`
- `domain:<value>`
- `layer:<value>`
- `status:<value>`

Allowed `layer` values:

- `atom`
- `molecule`
- `organism`
- `template`
- `page`

Allowed `status` values:

- `stable`
- `experimental`
- `deprecated`

For `layer:organism`, `layer:template`, and `layer:page`, add at least one usage tag:

- `used-in:block:<block-slug>`
- `used-in:route:<route>`
- `used-in:shared`

`used-in:shared` is allowed as a transitional fallback when a concrete route/block mapping is not finalized yet.

## Validation

Use `pnpm stories:governance:check` to validate every story under `src/**`, central MDX documentation page titles, and forbidden Storybook test or mock imports.

Use `pnpm stories:governance:check -- --base-ref origin/main` to apply the migration-on-touch rule to the commits after a Git base reference. Pull request CI passes its target branch as the base reference. A new or changed story under `src/stories/**` fails unless its path contains `prototypes/`.

## Canonical References

- [Atomic Architecture](./atomic-architecture.md)
