# Codex Instruction Router

## Canonical Source

- Canonical project instructions for Codex are layered `AGENTS.md` files resolved by repository path.
- Primary AI infrastructure name in this repository is `OpenAI`.

## Layered Instruction Map

- Repository-wide routing and execution constraints: `AGENTS.md`
- Application-wide engineering defaults: `src/AGENTS.md`
- UI components and frontend architecture: `src/components/AGENTS.md`, `src/app/(frontend)/AGENTS.md`
- UI and CMS boundary mapping: `src/blocks/AGENTS.md`, `src/app/AGENTS.md`, `src/stories/AGENTS.md`
- Payload/API/hooks/seeds: `src/collections/AGENTS.md`, `src/hooks/AGENTS.md`, `src/endpoints/seed/AGENTS.md`, `src/app/api/AGENTS.md`
- Payload admin UI design: `src/app/(payload)/AGENTS.md`, `src/components/organisms/AdminBranding/AGENTS.md`, `src/components/organisms/DeveloperDashboard/AGENTS.md`, `src/dashboard/adminDashboard/AGENTS.md`
- Tests: `tests/AGENTS.md`
- Normative AI anti-slop policy: `.github/instructions/ai-anti-slop.instructions.md`

## Instruction Design Principles (AI-Slop v2)

1. Prefer hierarchy over volume: prioritize P0/P1/P2 rules.
2. Keep constraints minimal and precise; avoid overloading prompts.
3. Remove conflicts across instruction files.
4. Use short examples only when they materially reduce ambiguity.
5. Scope rules through nested `AGENTS.md` files; avoid unnecessary global rules.

## Execution Requirements (Repository-Specific)

- Always read layered `AGENTS.md` instructions first.
- Validation policy is path-based:
  - Runtime-core changes that can affect runtime behavior: run `pnpm check`, `pnpm build`, `pnpm format`.
  - CI-critical only changes (`.github/workflows/**`, `.github/scripts/**`, `scripts/**`): run `pnpm check`, `pnpm format`.
  - Light-only docs/instruction changes: skip heavy runtime validation.
- If required `check` or `build` fails, fix first, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and network access to the Postgres Docker DB.
- AI-slop enforcement mode is `pre-push + deep-quality-lane`; it is intentionally not a blocking gate in the main PR CI workflow.
- When changing instruction sources (`AGENTS.md`, `**/AGENTS.md`, `**/AGENTS.override.md`, `.github/instructions/ai-anti-slop.instructions.md`), run `pnpm ai:slop-check` locally.
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

## Pull Request Metadata Rules

- Title format: `<type>(optional-scope)?: short summary`
- Allowed types/scopes: `.github/workflows/pr-gates.yml`
- Summary starts lowercase, imperative, and <= 72 chars.
- Start descriptions with a non-technical user-impact summary.
- For UI changes, include a `Screenshots:` section with affected states.
- Keep language concise and concrete.

## Language Policy

- Chat and explanations in German unless the user asks otherwise.
- Code, code comments, and documentation in English.

## Conflict Policy

- Keep canonical Codex rules in layered `AGENTS.md` files.
- Keep global anti-slop policy in `.github/instructions/ai-anti-slop.instructions.md`.
- Resolve duplicates in favor of the closest path-local `AGENTS.md` file.
