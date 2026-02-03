# Security Documentation Index

This index orients you through the platform security & identity documentation without repeating details.

## Reading Path (Recommended)
1. Authentication Overview – Purpose, actors, lifecycle concepts.
2. Auth Flow Diagram – Visual step sequence (login & provisioning path).
3. Provisioning Model – Guarantees around identity creation, linkage, cleanup.
4. Permission Matrix – Comprehensive reference of collection‑level access.

## Audiences & Goals
| Role               | Start With | Goal                                              |
| ------------------ | ---------- | ------------------------------------------------- |
| New Engineer       | 1 → 2      | Understand high‑level model before touching hooks |
| Security / Auditor | 1 → 3 → 4  | Assess separation of concerns & RBAC boundaries   |
| Product Owner      | 1          | Grasp user categories & approval gating           |
| Ops / SRE          | 3          | Monitor provisioning integrity signals            |

## Conceptual Boundaries
- Identity Source: Supabase (external) – token based.
- Authorization Boundary: Payload collections & access functions.
- Lifecycle Logic: Hook layer (no frontend enforcement).
- RBAC Surface: Permission Matrix (single source of truth for CRUD scope).

## Quick Links
- 01 Authentication Overview: `authentication-system.md`
- 02 Auth Flow Diagram: `auth-flow-diagram.md`
- 03 Provisioning Model: `supabase-provisioning.md`
- 04 Permission Matrix: `permission-matrix.md`
 - Overrides (temporary): `overrides.md` — temporary record of pnpm security-related overrides and rationale. See `docs/security/overrides.md`.

## Change Guidelines
- Don’t add function names or code snippets here; link to folders instead.
- Keep high‑level intent stable; update dates only when semantics change.
- New user category? Update Overview (actor table), Provisioning (scope table), Permission Matrix (rows); diagram only if flow diverges.
 - Temporary overrides doc: `docs/security/overrides.md` contains the rationale for current `pnpm.overrides` pins. This file is intentionally temporary; move into `.github/` or reference from PRs once the content is finalized.
