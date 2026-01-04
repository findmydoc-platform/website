# Frontend Atomic Architecture

This document explains how findmydoc structures shared UI according to atomic design. It is the single source of truth for where components live, how they are named, and how new UI should be introduced.

## Directory Layout

```
src/components/
  atoms/        # shadcn/ui primitives and other presentational leaf components
  molecules/    # small compositions of atoms (buttons + icons, pagination controls, etc.)
  organisms/    # feature blocks composed of molecules/atoms (forms, cards, nav, hero blocks)
  templates/    # layout wrappers that orchestrate organisms and data-loading
  pages/        # reusable page-level assemblies (rarer – App Router pages still live under src/app)
```

Every file under these folders uses the alias `@/components/<layer>/<Component>`.

## Layer Definitions

| Layer | Responsibilities | Examples |
| --- | --- | --- |
| atoms | Styling + accessibility only. No Payload types, business logic, or routing knowledge. All shadcn/ui components live here. | `button`, `input`, `dialog`, icons, minimal display components |
| molecules | Combine multiple atoms for a focused pattern. Light mapping/props logic allowed; no side effects. | `CMSLink`, `Pagination`, layout helpers (`Container`, `PageRange`) |
| organisms | Feature or block-level UI. May accept Payload types and orchestrate local state. No cross-block business rules; delegate data fetching upward when possible. | `Auth` forms, `Card`, `CollectionArchive`, block renderers |
| templates | Page chrome/layout wrappers or sections that fetch data and pass it to organisms. Often server components. | Site `Header`, `Footer`, dashboard shells |
| pages | Shared page assemblies that multiple App Router routes can reuse. Use sparingly. | marketing landing composition, repeated list/detail pattern |

### Templates: Server Wrapper + Presentational UI

- Templates will often be split into:
  - A **server wrapper** (`Component.tsx`) that fetches Payload globals or other data and passes props down.
  - A **presentational UI** sibling (for example `Component.client.tsx` or `FooterContent.tsx`) that renders the actual layout and is safe to use in Storybook.
- Layouts and routes should import the server wrapper; Storybook and other purely UI contexts should import the presentational component directly.

## Payload Blocks ↔ Organisms

- Each Payload block slug **must** map to a component under `src/components/organisms/<BlockSlug>`.
- `src/blocks/<BlockSlug>/Component.tsx` should only import that organism and pass CMS data.
- When new blocks are created, add their organism counterpart in the same PR.

## Path Aliases

`tsconfig.json`, Vitest, and tooling expose these aliases:

```
@/components/atoms/*
@/components/molecules/*
@/components/organisms/*
@/components/templates/*
@/components/pages/*
```

Use them instead of deep relative paths. If you add a new layer directory, update the aliases and this doc.

## Working with Shadcn / CLI

1. `components.json` keeps the `components` alias pointed at `src/components/atoms`.
2. Run `npx shadcn-ui@latest add <component>` and commit the generated atom under `atoms/`.
3. Never rename the `atoms` folder or move primitives elsewhere.
4. When customizing variants, follow CVA conventions described in `.github/instructions/frontend.instructions.md`.

## Migration Guide

1. **Create the target folder** (e.g., `src/components/molecules/navigation`).
2. **Move the component** and update its imports to use the new alias.
3. **Fix call sites** by swapping `@/components/<old-path>` to the new alias.
4. **Update blocks** (if applicable) so each block imports from `organisms`.
5. **Document the move** in the component’s README or relevant docs if behavior changed.

Work in small slices (one feature area per PR) to keep diffs reviewable.

## Checklist for New UI

- [ ] Decide the correct layer.
- [ ] Create the component under that folder using PascalCase filenames.
- [ ] **Strictly follow the Compound Component pattern** for multi-part UIs (see `.github/instructions/frontend.instructions.md`).
- [ ] Import lower layers only (no cycles up the hierarchy).
- [ ] Keep business logic in Payload or hooks; UI files focus on presentation and light mapping.
- [ ] Update or add tests as needed.
- [ ] Mention the change in release notes/docs if it affects block availability or templates.

## Related Documentation

- [Animation Stack](./animations.md)
