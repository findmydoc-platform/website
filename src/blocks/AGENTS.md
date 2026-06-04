# Block Adapter Rules (findmydoc)

## Priorities

- `P0`: Apply the shared Payload/UI boundary from `src/AGENTS.md`.
- `P1`: Keep block adapter logic explicit and small.
- `P2`: Preserve reusable component portability.

## Critical Rules

- Follow `src/AGENTS.md` for the canonical Payload source-of-truth, normalized UI contracts, and component boundary rules.
- Keep block components responsible for adapting Payload block data into normalized UI props.
- Put cross-block normalizers and CMS helpers in `src/blocks/_shared/**`.
- Do not move reusable styling or variants into blocks when `src/components/**` is the better home.

## Enforcement

If a block needs Payload imports, keep them at the block adapter boundary and pass normalized props into reusable UI.
