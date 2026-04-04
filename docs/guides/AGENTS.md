# Usage Guides

## Priorities

- `P0`: Current, user-facing accuracy.
- `P1`: Deterministic operator guidance with useful screenshots.
- `P2`: Concise, non-technical wording.

## Critical Rules

- Keep guides aligned with the current user-facing flow, not historical behavior.
- If a guide already exists for the same workflow, update that guide instead of creating a duplicate.
- When the relevant flow changes, update the guide in the same change whenever the new behavior is known.
- Treat these changes as guide-relevant even if only code changed:
  - navigation path
  - button, tab, field, or collection names
  - prerequisites, permissions, or required seed state
  - success states, warnings, empty states, or validation behavior
- Refresh screenshots when the visible UI changed; do not keep stale screenshots.
- Remove or rewrite steps that are no longer true.
- If the flow cannot be fully reproduced, state clearly which portion was verified and which later steps are based on the current implementation.

## Writing Defaults

- Default language for these guides is German.
- Default reader address is `du`.
- Prefer exact UI labels over internal terminology.

## Validation Expectations

- Run `pnpm format` after changing guides or guide instructions.
- When changing this file, also run `pnpm ai:slop-check`.
