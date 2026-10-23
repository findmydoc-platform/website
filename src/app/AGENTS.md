# App Route Boundary Rules (findmydoc)

## Critical Rules

- Follow `src/AGENTS.md` for the canonical Payload source-of-truth, normalized UI contracts, and component boundary rules.
- Keep route-level fetching, preview handling, redirects, and page assembly in `src/app/**`.
- Pass normalized props and callback ports into reusable UI rather than leaking route, Payload, or API transport into presentational components.
- Coordinate shared CMS mapping with `src/blocks/**` or `src/blocks/_shared/**` when the same shape is used outside one route.

## Enforcement

If route code needs Payload imports, keep them at the route or adapter boundary and pass normalized props and callback ports into reusable UI.
