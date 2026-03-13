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
  - Runtime-core changes that can affect runtime behavior: run `pnpm check`, `pnpm build`, `pnpm format`.
  - CI-critical only changes (`.github/workflows/**`, `.github/scripts/**`, `scripts/**`): run `pnpm check`, `pnpm format`.
  - Light-only docs/instruction changes: skip heavy runtime validation.
- If required `check` or `build` fails, fix first, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and network access to the Postgres Docker DB.
- AI-slop enforcement mode is `pre-push + deep-quality-lane`; it is intentionally not a blocking gate in the main PR CI workflow.
- When changing instruction sources (`AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/**`, `.github/prompts/**`, `.github/agents/**`), run `pnpm ai:slop-check` locally.
- For UI changes, always save Playwright screenshots in an ignored Playwright artifacts folder, review the change via those screenshots and runtime logs, and fix it immediately if the result is not correct or not good enough.
- Install hooks once with `pnpm hooks:install` to enable the pre-push AI-slop gate.

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
