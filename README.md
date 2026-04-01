# findmydoc portal

The findmydoc portal is a PayloadCMS‑powered platform that helps international patients discover trusted clinics and specialists.

## Quick Start

1. git clone https://github.com/findmydoc-platform/website.git
2. cp .env.example .env
3. pnpm install
4. start development:
   a. `docker compose up` or
   b. `docker compose run --rm postgres` & `pnpm run dev`
5. Open http://localhost:3000

## Environment variables

- `NEXT_PUBLIC_SUPABASE_RESET_REDIRECT` — absolute URL that Supabase uses when sending password recovery emails. Point it to the public password reset completion page (for example, `https://example.com/auth/password/reset/complete`).

## Development

- Connect to Vercel: see [Setup Docs](docs/setup.md#connect-to-vercel)
- Migrations & Schema changes: see [Setup Docs](docs/setup.md#migrations)
- Seed database: see [Setup Docs](docs/setup.md#seed) and detailed [Seeding System](docs/seeding.md)
- Deployment process: see [Deployment & Migration Runbook](docs/deployment-runbook.md)
- Local disposable DB reset: see [Local Database Reset (Test Only)](docs/database-reset.md)
- Local Development Setup: see [Setup Docs](docs/setup.md#local-development)
- UI atoms: all shadcn/ui primitives live in `src/components/atoms` and must be imported via `@/components/atoms/<component>`; run shadcn CLI commands only after confirming the alias still points to that folder in `components.json`.

## Quality Gates

AI anti-slop and quality hygiene are enforced through local and CI lanes:

- Local lane (pre-push): scoped AI-slop check for changed instruction files.
- Fast lane (PR blocking): essential quality checks and tests.
- Deep lane (main + nightly): full anti-slop, dependency, dead-code, and workflow security checks.

Key quality commands:

- `pnpm ai:slop-check`
- `pnpm deadcode:check`
- `pnpm deps:graph:check`
- `pnpm deps:dedupe:check`
- `pnpm deps:audit`

Hook setup:

- `pnpm hooks:install`

Reference: [AI Anti-Slop Playbook](docs/engineering/ai-anti-slop-playbook.md)

## Production

TBD

## Documentation

- [Documentation Index](./docs/README.md)
- [PayloadCMS Docs](https://payloadcms.com/docs/)
- [Features & Integrations](./docs/features.md)
- [PostHog Analytics](./docs/integrations/posthog.md)
- [Authentication System](./docs/security/authentication-system.md)
- [Setup & Development](./docs/setup.md)
- [Storage Configuration](./docs/integrations/storage.md)
- [Frontend Atomic Architecture](./docs/frontend/atomic-architecture.md)
- [Animation Stack](./docs/frontend/animations.md)
- [Architecture Decision Records (ADRs)](./docs/adrs/)
