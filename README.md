# Findmydoc Portal

A PayloadCMS‑powered website template for blogs, portfolios, and content publishing.

## Quick Start

1. git clone https://github.com/findmydoc-platform/website.git
2. cp .env.example .env
3. pnpm install
4. start development:
   a. `docker compose up` or
   b. `docker compose run --rm postgres` & `pnpm run dev`
5. Open http://localhost:3000

## Development

- Connect to Vercel: see [Setup Docs](docs/setup.md#Connect-to-Vercel)
- Migrations & Schema changes: see [Setup Docs](docs/setup.md#Migrations)
- Seed database: see [Setup Docs](docs/setup.md#Seed)
- Full scratch DB reset: see [Database Reset Workflow](docs/database-reset.md)
- Local Development Setup: see [Setup Docs](docs/setup.md#Local-Development)

## Production

TBD

## Documentation

- [PayloadCMS Docs](https://payloadcms.com/docs/)
- [Features & Integrations](./docs/features.md)
- [PostHog Analytics](./docs/posthog-integration.md)
- [Authentication System](./docs/authentication-system.md)
- [Setup & Development](./docs/setup.md)
- [Storage Configuration](docs/storage-configuration.md)
