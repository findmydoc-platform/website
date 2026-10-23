# Block Adapter Rules (findmydoc)

## Critical Rules

- Follow `src/AGENTS.md` for the canonical Payload source-of-truth, normalized UI contracts, and component boundary rules.
- Keep block components responsible for adapting Payload block data and external UI actions into normalized props and callback ports.
- Put cross-block normalizers and CMS helpers in `src/blocks/_shared/**`.
- Do not move reusable styling or variants into blocks when `src/components/**` is the better home.

## Enforcement

If a block needs Payload imports, keep them at the block adapter boundary and pass normalized props and callback ports into reusable UI.
