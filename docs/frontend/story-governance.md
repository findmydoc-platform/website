# Story Governance

This document defines the canonical metadata contract for Storybook stories in this repository.

## Purpose

Story metadata must stay searchable by domain and lifecycle stage while keeping Atomic Design layering explicit.

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

Use `pnpm stories:governance:check` to validate title and tags.

## Canonical References

- [Atomic Architecture](./atomic-architecture.md)
