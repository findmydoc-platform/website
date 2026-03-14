# Codex Instruction Router

## Canonical Source

- Canonical global rules: `.github/copilot-instructions.md`
- `AGENTS.md` stays focused on routing and execution constraints.

## Scoped Instruction Map

- Frontend and UI: `.github/instructions/frontend.instructions.md`
- Payload admin UI branding, theme, and widgets: `.github/instructions/admin-ui-design.instructions.md`
- CMS/UI boundary: `.github/instructions/cms-ui-boundary.instructions.md`
- Payload, API, hooks, and seeds: `.github/instructions/payload.instructions.md`
- Tests: `.github/instructions/tests.instructions.md`
- PR metadata only: `.github/instructions/pull-requests.instructions.md`
- AI anti-slop policy: `.github/instructions/ai-anti-slop.instructions.md`

## Instruction Design Principles (AI-Slop v2)

1. Prefer hierarchy over volume: prioritize P0/P1/P2 rules.
2. Keep constraints minimal and precise; avoid overloading prompts.
3. Remove conflicts across global and scoped instruction files.
4. Use short examples only when they materially reduce ambiguity.
5. Scope rules to relevant files via `applyTo`; avoid unnecessary global rules.

## Execution Requirements (Repository-Specific)

- Always read `.github` instructions first.
- Validation policy is path-based:
  - `pnpm format` runs for every change because it is fast and deterministic.
  - `pnpm check` is required when code, hooks, runtime configuration, schema, or lint-relevant files change.
  - `pnpm build` runs when build-relevant sources (Next.js/Storybook entry points, Payload config, routing, or tooling that affects the output) change; skip it for pure docs/content edits.
  - CI-critical only changes (`.github/workflows/**`, `.github/scripts/**`, `scripts/**`) still need `pnpm check` + `pnpm format`.
  - Light-only docs/instruction changes that do not touch runtime code can omit build/check but must still run `pnpm format`.
- If required `check` or `build` fails, fix first, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and network access to the Postgres Docker DB.
- AI-slop enforcement mode is `pre-push + deep-quality-lane`; it is intentionally not a blocking gate in the main PR CI workflow.
- When changing instruction sources (`AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/**`, `.github/prompts/**`, `.github/agents/**`), run `pnpm ai:slop-check` locally.
- For UI changes, always save Playwright screenshots in an ignored Playwright artifacts folder, review the change via those screenshots and runtime logs, and fix it immediately if the result is not correct or not good enough.
- Install hooks once with `pnpm hooks:install` to enable the pre-push AI-slop gate.

## Environment and Secret Workflow

- New or missing environment variables for `findmydoc-platform/website` must be added to `/Users/razorspoint/.codex/local/findmydoc-website.env`.
- Only copy `/Users/razorspoint/.codex/local/findmydoc-website.env` to the repo root when the project `.env` lacks the required keys; do not fallback if the project already defines them.
- If the fallback file is missing or variables remain unresolved after copying, stop and warn explicitly that the project `.env` is incomplete.
- Run `detect-secrets-hook` on changed files before committing; if it regenerates `.secrets.baseline`, commit the updated baseline so the CI scan stays in sync.

## Selective Test Guidance

- Run unit, integration, and Storybook tests locally only for the suites that correspond to files you modified (e.g., `pnpm vitest tests/unit/foo.spec.ts`).
- Skip unrelated test suites during normal development runs; rely on the pipeline for broad coverage after the selective run.

## Payload Migration Workflow

- Run Payload migration commands only when schema or data-model code changes.
- Create migrations only via `pnpm payload migrate:create <migration_name>`.
- Never create migration files manually from scratch.
- If a Payload command prompts for confirmation, use non-interactive execution:
  - `bash -lc "printf 'y\n' | PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate"`
  - `bash -lc "printf 'y\n' | PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate:fresh"`
- Status checks:
  - `bash -lc "PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate:status"`

## Language Policy

- Chat and explanations in German unless the user asks otherwise.
- Code, code comments, and documentation in English.

## Conflict Policy

- Keep global rules in `.github/copilot-instructions.md`.
- Keep domain specifics in `.github/instructions/*.instructions.md`.
- Resolve duplicate or conflicting guidance in favor of the scoped file for its domain.
