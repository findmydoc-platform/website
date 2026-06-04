# App Route Boundary Rules (findmydoc)

## Priorities

- `P0`: Apply the shared Payload/UI boundary from `src/AGENTS.md`.
- `P1`: Keep route and data-loading concerns separate from reusable UI.
- `P2`: Keep adapter logic explicit and small.

## Critical Rules

- Follow `src/AGENTS.md` for the canonical Payload source-of-truth, normalized UI contracts, and component boundary rules.
- Keep route-level fetching, preview handling, redirects, and page assembly in `src/app/**`.
- Pass normalized props into reusable UI rather than leaking route or Payload shapes into presentational components.
- Coordinate shared CMS mapping with `src/blocks/**` or `src/blocks/_shared/**` when the same shape is used outside one route.

## Enforcement

If route code needs Payload imports, keep them at the route or adapter boundary and pass normalized props into reusable UI.
