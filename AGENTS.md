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
- Before creating any git commit that changes tracked files, run `pnpm format` first, even for docs-only or test-only work.
- If required `check` or `build` fails, fix first, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and network access to the Postgres Docker DB.
- AI-slop enforcement mode is `pre-push + deep-quality-lane`; it is intentionally not a blocking gate in the main PR CI workflow.
- When changing instruction sources (`AGENTS.md`, `**/AGENTS.md`, `**/AGENTS.override.md`), run `pnpm ai:slop-check` locally.
- For UI changes, always save Playwright screenshots in an ignored Playwright artifacts folder, review the change via those screenshots and runtime logs, and fix it immediately if the result is not correct or not good enough.
- When sharing screenshots in chat responses, embed them inline as Markdown images using absolute filesystem paths; avoid plain linked file paths unless explicitly requested.
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
- Build PR descriptions in a temporary markdown file or heredoc, then pass them with `gh pr create --body-file` or `gh pr edit --body-file`.
- Never pass multiline PR bodies inline through shell quoting, and never rely on literal `\n` sequences to create paragraph breaks.
- Verify the rendered PR body with `gh pr view --json body` before sharing the link.

## Language Policy

- Chat and explanations in German unless the user asks otherwise.
- Code, code comments, and documentation in English.

## Conflict Policy

- Keep canonical Codex rules in layered `AGENTS.md` files.
- Resolve duplicates in favor of the closest path-local `AGENTS.md` file.

## AI Anti-Slop Policy v2

Scope exception: Global scope is intentional because this policy defines cross-repository communication quality defaults.

Rule budget:

- Max 8 hard rules in this section.
- Max 120 lines in this section.

## Priorities

- `P0`: Correctness, factual grounding, and conflict-free guidance.
- `P1`: Direct completion of the user task with actionable outputs.
- `P2`: Style, brevity, and readability.

## Required Output Quality

- Rule 1: State concrete facts with references (files, commands, logs, or links).
- Rule 2: Separate facts from recommendations.
- Rule 3: Keep responses concise and implementation-oriented.

## Uncertainty & Evidence

- Rule 4: Mark unresolved assumptions explicitly.
- Rule 5: Add a confidence statement when evidence is incomplete.

`Assumption:` State unknowns or defaults explicitly.
`Confidence:` Provide a short confidence level tied to available evidence.

## Forbidden Patterns

- Rule 6: Do not use empty reassurance, hype, or social filler.
- Rule 7: Do not hide uncertainty behind authoritative wording.

## Scope & Brevity

- Rule 8: Use only the constraints needed for this task context; avoid long, repetitive instruction payloads.
- Keep examples short and only when they reduce ambiguity.
