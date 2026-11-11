# findmydoc portal

The findmydoc portal is a PayloadCMS‑powered platform that helps international patients discover trusted clinics and specialists.

## License

This repository is proprietary and source-available. The source code may be visible, but the project is not open source and no permission is given to use, copy, modify, publish, distribute, redistribute, sublicense, or create derivative works from any part of this repository.

All rights are reserved by findmydoc. See [LICENSE.md](./LICENSE.md) for the full license terms and [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution terms.

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

### Type checking and compiler API compatibility

Run `pnpm typecheck` for route type generation and the complete project type check. `pnpm check` includes this
command alongside lint, native authorization checks, test structure checks, and generated Payload type validation.
The required CI Static Checks job also runs it when path routing omits the application build. Documentation-only
omissions retain their existing policy.

The project compiler is pinned to TypeScript 7.0.2. The type-check command calls its local CLI explicitly.
Next.js 16.4 uses the same project-local compiler CLI during `pnpm build`, with type errors blocking the build.
Production builds retain the [webpack fallback](./docs/adrs/024-adr-production-build-webpack-fallback.md).

TypeScript 7 does not provide the JavaScript compiler API used by ESLint, Storybook docgen, dependency-cruiser,
Payload MCP schema conversion, and repository source-analysis checks. `typescript-legacy` pins that API to 5.9.3.
Repository checks import this alias explicitly. The named compatibility list in `.pnpmfile.cjs` binds third-party
API consumers to a direct TypeScript 5.9.3 dependency instead of a peer resolved against the project compiler.
For ad hoc `ts-node` use, select the API explicitly with
`pnpm exec ts-node --compiler typescript-legacy`. Add a package to the list only after verifying its compiler API use.

Use the pinned pnpm version from `packageManager` and `pnpm install --frozen-lockfile` to reproduce both versions.
With pnpm 10.28.2, duplicate bins from the two packages select the higher `typescript` version, so `pnpm exec tsc
--version` reports 7.0.2. The required command and Next.js resolve the root compiler directly.

## Quality Gates

AI anti-slop and quality hygiene are enforced through local and CI lanes:

- Local lane: staged-file `pre-commit` checks plus a `pre-push` dead-code check and scoped AI-slop check.
- Fast lane (PR blocking): merge-critical validation, tests, and build readiness.
- Security lane: workflow and secret scanning for CI/security-relevant changes plus scheduled runs.
- Semgrep lane: blocking SAST scans for application changes in pull requests and on `main`.
- Deep lane (main + nightly): anti-slop and repository hygiene checks such as dead-code and dependency health.

Key quality commands:

- `pnpm ai:slop-check`
- `pnpm deadcode:check`
- `pnpm deps:graph:check`
- `pnpm deps:dedupe:check`
- `pnpm deps:audit`

Hook setup:

- `pnpm install` configures `.githooks` automatically in local Git worktrees.
- `pnpm hooks:install` reapplies hook setup manually if needed.
- `pre-commit` runs `pnpm deps:dedupe:check` when `package.json` or `pnpm-lock.yaml` is staged. Only an explicit pnpm dedupe finding triggers `pnpm dedupe --lockfile-only --ignore-scripts`; the cleaned lockfile joins the same commit. Authentication, network, and other check failures stop the commit without attempting a repair. Partially staged files and unstaged manifest or lockfile changes must be staged or stashed first.
- `pre-push` runs `pnpm deadcode:check` on every push, including documentation-only changes. It does not inspect changed paths or remote refs first. Findings and configuration or loader errors stop the push.
- Knip analyzes the Payload config and admin importmap statically to avoid executing server and JSX modules during configuration loading.

Reference: [AI Anti-Slop Playbook](docs/engineering/ai-anti-slop-playbook.md)

PR Validation and Preview read the same native path-filter policy. They omit application builds and new Preview deployments only when every changed path is an approved test case, repository metadata or named documentation path. Test support, runtime inputs and unknown paths still require builds. PR Validation records permitted omissions and rejects missing expected test and coverage results. Pure modifications of existing integration cases use native verified file selection plus the collection contract and explicitly incomplete coverage. Uncertain, mixed or shared-input changes run full integration. Main full integration runs independently of the application-build decision. The seven required checks remain unchanged; Integration and Combined Coverage remain optional merge checks. See [CI results and full integration](docs/testing/strategy.md#ci-results-and-full-integration) for the result contract and frozen normal-CI reference.

[The recorded reference runs and acceptance limits](docs/testing/strategy.md#normal-ci-evidence-and-acceptance) distinguish preserved validation from measured savings. Six normal PR/Main pairs meet the observed acceptance criteria: both repetitions in each class complete PR validation sooner and use fewer recurring runner seconds, including Preview and all associated Main attempts. Results cover the preserved Unit-test, issue-template and existing-integration comment changes; they do not establish a universal runtime or billing gain. Investigation work is separate. Complete evidence supports resolution of implementation tickets #2076 through #2079 only; parent spec #2075 and the management deliverable remain open.

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
