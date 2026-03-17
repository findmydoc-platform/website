# App UI and Payload Boundary Rules (findmydoc)

## Priorities

- `P0`: Keep Payload as source of truth and avoid leaking CMS shapes into reusable UI.
- `P1`: Preserve presentational component portability and testability.
- `P2`: Keep adapter logic explicit and small.

## Critical Rules

- `src/components/**` must stay Payload-free.
- Do not import `@/payload-types` in atoms/molecules/organisms/templates.
- Normalize Payload unions (links/media/relations) in `src/blocks/**` or `src/blocks/_shared/**`.
- Compute CMS-derived routes in adapters, not presentational components.

## Normalized Contracts

- Links in UI: `{ href: string; label?: string | null; newTab?: boolean }`
- Rich text in UI: `ReactNode`
- Media in UI: `{ src?: string; width?: number; height?: number; alt?: string }`

## Placement Rules

- Reusable styling and variants: `src/components/**`.
- Payload-aware mapping: `src/blocks/**`.
- Shared CMS adapters: `src/blocks/_shared/**`.

## Enforcement

If a component needs Payload imports, move mapping to a block adapter and pass normalized props into the UI layer.
