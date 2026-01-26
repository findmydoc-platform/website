---
applyTo: 'src/components/**/*,src/blocks/**/*,src/app/**/*.tsx,src/stories/**/*'
---

# UI ↔ Payload Boundary Rules (findmydoc)

This repo uses **PayloadCMS as source of truth**. The frontend follows **Smart Shells + Dumb UI**.

## Golden Boundary

- `src/components/**` (atoms/molecules/organisms/templates) must be **Payload-free**:
  - Do **not** import from `@/payload-types`.
  - Do **not** accept Payload-shaped unions like `{ type, reference, url }` or upload relationship unions (`document | id | null`).
  - Do **not** compute routes from Payload reference relations (`relationTo/value.slug`).

- `src/blocks/**` is the **CMS integration layer**:
  - Block components are **adapters**: normalize Payload block data into presentational props.
  - Block config (`src/blocks/<Slug>/config.ts`) defines editor fields; block adapter (`Component.tsx`) owns mapping logic.

## Normalization Patterns

### Links

- Presentational UI should accept a normalized link:
  - `{ href: string; label?: string | null; newTab?: boolean }`
  - Presentation-only props (e.g. `appearance` / `variant`) are OK as long as they are not Payload-shaped.
- Payload link shapes (custom/reference/url/reference.value.slug) must be resolved in:
  - a block adapter (`src/blocks/<Slug>/Component.tsx`) OR
  - a shared CMS adapter (`src/blocks/_shared/**`), e.g. `CMSLink`.

### Rich Text

- Presentational UI should accept `ReactNode`.
- Payload Lexical rich text objects should be rendered to a node in the adapter using the existing `RichText` organism.

### Media / Uploads

- Presentational UI should accept `{ src?: string; width?: number; height?: number; alt?: string }`.
- Payload upload relationship unions must be normalized in the adapter (handle document vs id vs null; pick sizes; fall back to url).

## Where Things Live

- Reusable styling + variants: `src/components/**`
  - Example: `UiLink` lives in `src/components/molecules/Link/index.tsx`.
- Payload-aware adapters: `src/blocks/**`
  - Example: `CMSLink` lives in `src/blocks/_shared/CMSLink.tsx`.

## Enforcement Heuristic

If a component needs to import `@/payload-types`, it should not be in `src/components/**`.
Move the logic into a block adapter or `src/blocks/_shared/**` and pass normalized props into UI.
