# Frontend Atomic Architecture

This document is the single source of truth for findmydoc's shared UI Atomic Design structure, component placement, and naming.

Use Atomic Design.

## Directory Layout

```
src/components/
  atoms/        # shadcn/ui primitives and other presentational leaf components
  molecules/    # small compositions of atoms (buttons + icons, pagination controls, etc.)
  organisms/    # feature blocks composed of molecules/atoms (forms, cards, nav, hero blocks)
  templates/    # layout wrappers that orchestrate organisms through normalized inputs
  pages/        # reusable page-level assemblies (rarer – App Router pages still live under src/app)
```

Every file under these folders uses the alias `@/components/<layer>/<Component>`.

## Layer Definitions

| Layer     | Responsibilities                                                                                                                                          | Examples                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| atoms     | Styling and accessibility only. No Payload types, business logic, or routing knowledge. All shadcn/ui components live here.                              | `button`, `input`, `dialog`, icons, display primitives      |
| molecules | Combine atoms for one focused pattern. Light prop mapping is allowed; side effects are not.                                                               | `Pagination`, layout helpers such as `Container`            |
| organisms | Feature or block-level UI with normalized props, callback ports, and local interaction state. No Payload types or API transport.                           | `Auth` forms, `Card`, `CollectionArchive`, block renderers  |
| templates | Reusable page chrome, sections, and layout composition. They receive normalized props and callback ports and do not fetch Payload or application API data. | Site `Header`, `Footer`, dashboard shells                   |
| pages     | Shared page assemblies that multiple App Router routes can reuse. Use sparingly and keep Payload access in route or block adapters and application API access in route, block, or feature-boundary adapters. | Marketing compositions and repeated list or detail patterns |

### Route and block adapters with presentational UI

- `src/AGENTS.md` defines the canonical adapter ownership for Payload and application API access.
- Feature-boundary adapters live under `src/features/<feature>/**` and pass normalized props and callback ports to reusable UI.
- Across the Server–Client boundary, pass serializable data or Server Actions. Create browser callback ports in the owning client adapter at the interaction leaf; reusable UI remains transport-free.
- Reusable templates render those inputs and remain safe to use in Storybook.
- Shared server mapping belongs in route utilities, `src/blocks/**`, or `src/blocks/_shared/**`, not in `src/components/**`.
- Path-local Payload Admin UI follows the exceptions in its closest `AGENTS.md`.

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
4. When customizing variants, follow CVA conventions described in `src/components/AGENTS.md`.

## Migration Guide

1. **Create the target folder** (e.g., `src/components/molecules/<FeatureName>`).
2. **Move the component** and update its imports to use the new alias.
3. **Fix call sites** by swapping `@/components/<old-path>` to the new alias.
4. **Update blocks** (if applicable) so each block imports from `organisms`.
5. **Document the move** in the component’s README or relevant docs if behavior changed.

Work in small slices (one feature area per PR) to keep diffs reviewable.

## Component Placement Checklist

- [ ] Decide the correct layer.
- [ ] Create the component under that folder using PascalCase filenames.
- [ ] **Strictly follow the Compound Component pattern** for multi-part UIs (see `src/components/AGENTS.md`).
- [ ] Import lower layers only (no cycles up the hierarchy).
- [ ] Apply the canonical adapter ownership from `src/AGENTS.md`; UI files use normalized props, callback ports, and local interaction state.
- [ ] Update or add tests as needed.
- [ ] Mention the change in release notes/docs if it affects block availability or templates.

## Related Documentation

- [Animation Stack](./animations.md)
- [Content Data Access](./content-data-access.md)
- [Story Governance](./story-governance.md)
