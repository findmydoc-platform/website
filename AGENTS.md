# Codex Instruction Router

## Canonical Source

- Canonical global rules: `.github/copilot-instructions.md`
- No duplication in `AGENTS.md`; only routing and Codex execution constraints.

## Scoped Instruction Map

- Frontend and UI: `.github/instructions/frontend.instructions.md`
- CMS/UI boundary: `.github/instructions/cms-ui-boundary.instructions.md`
- Payload, API, hooks, and seeds: `.github/instructions/payload.instructions.md`
- Tests: `.github/instructions/tests.instructions.md`
- PR metadata only: `.github/instructions/pull-requests.instructions.md`

## Execution Requirements (Repository-specific)

- Always read `.github` instructions first.
- Run validation commands only when changes touch runtime core paths or CI-critical code paths.
- Runtime core paths include:
  - Application/runtime code (`src/**`)
  - Payload code and schema (`src/collections/**`, `src/globals/**`, `src/hooks/**`, `src/payload.config.ts`, `src/migrations/**`, `src/endpoints/seed/**`)
  - Test code (`tests/**`, `vitest.config.ts`)
  - Build/tooling config (`package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.js`, `eslint.config.mjs`, `postcss.config.js`)
- CI-critical paths include:
  - CI workflows and CI scripts (`.github/workflows/**`, `.github/scripts/**`)
  - Repository automation scripts (`scripts/**`)
- If runtime core paths changed in a way that can affect runtime behavior, run: `pnpm check`, `pnpm build`, `pnpm format`.
- If only CI-critical paths changed (without runtime core changes), run: `pnpm check`, `pnpm format`.
- If `check` or `build` fails where required: fix issues, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and execution outside the sandbox with network access to the Postgres Docker database.
- Skip `pnpm check`, `pnpm build`, and migration/build-related steps when only light paths changed (for example `AGENTS.md`, `README.md`, other root `*.md` files, `docs/**`, `.github/copilot-instructions.md`, `.github/instructions/**`, `.github/prompts/**`, `.github/ISSUE_TEMPLATE/**`), and keep this list aligned with `.github/workflows/deploy.yml` path filters.

## Payload Migration Workflow

- Run Payload migration commands only when Payload schema or related data model code changed.
- Create schema migrations only with `pnpm payload migrate:create <migration_name>`.
- Never create migration files manually from scratch.
- If Payload commands can prompt for confirmation, run non-interactive commands to auto-confirm and avoid blocking:
  - `bash -lc "printf 'y\n' | PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate"`
  - `bash -lc "printf 'y\n' | PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate:fresh"`
- For status checks, use:
  - `bash -lc "PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate:status"`
- Manual edits to generated migration files are allowed only after `migrate:create` generated them.
- Any manual migration adjustment must be documented:
  - Add a short inline comment in the migration file describing what was changed and why.
  - Add the same rationale to commit/PR notes (or linked issue comment) for traceability.

## Language Policy

- Chat and explanations in German unless the user asks otherwise.
- Code, code comments, and documentation in English.

## Conflict Policy

- Avoid conflicting rules across files.
- Keep global rules in `.github/copilot-instructions.md`.
- Keep scoped specifics only in `.github/instructions/*.instructions.md`.
