# Codex Instruction Router

## Canonical Source

- Canonical project instructions for Codex are layered `AGENTS.md` files resolved by repository path.
- Primary AI infrastructure name in this repository is `OpenAI`.

## Repo-Local Skills

- Repository-local Codex skills can live under `.codex/skills/`.
- Use `.codex/skills/gh-release-publish` when the task is to compute the next semantic release, publish a GitHub release, dispatch the production deploy workflow, or send the release announcement to Google Chat.

## Repo-Local Agents

- Read-only specialist agents can live under `.codex/agents/`.
- Use `.codex/agents/mobile-ui-reviewer.toml` when the task is to review mobile-first UI behavior, responsive layout risks, or touch-first interaction issues in the frontend.

## Layered Instruction Map

- Repository-wide routing and execution constraints: `AGENTS.md`
- Usage guides and operator documentation: `docs/guides/AGENTS.md`
- Application-wide engineering defaults: `src/AGENTS.md`
- UI components and frontend architecture: `src/components/AGENTS.md`, `src/app/(frontend)/AGENTS.md`
- Mobile-first frontend heuristics and prompt scaffolding: `docs/frontend/mobile-ai-playbook.md`
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
  - `pnpm format` runs for every change because it is fast and deterministic.
  - `pnpm check` is required when code, hooks, runtime configuration, schema, or lint-relevant files change.
  - `pnpm build` runs when build-relevant sources (Next.js/Storybook entry points, Payload config, routing, or tooling that affects the output) change; skip it for pure docs/content edits.
  - CI-critical only changes (`.github/workflows/**`, `.github/scripts/**`, `scripts/**`) still need `pnpm check` + `pnpm format`.
  - Light-only docs/instruction changes that do not touch runtime code can omit build/check but must still run `pnpm format`.
- Before creating any git commit that changes tracked files, run `pnpm format` first, even for docs-only or test-only work.
- If required `check` or `build` fails, fix first, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and network access to the Postgres Docker DB.
- Keep `detect-secrets` in sync with the branch before push. If secret scanning updates `.secrets.baseline`, include that file in the same change set.
- Treat `.secrets.baseline` drift as required maintenance so CI `Detect secrets` does not fail on baseline updates.
- AI-slop enforcement mode is `pre-commit + pre-push + deep-quality-lane`; AI-slop itself remains intentionally non-blocking in the main PR CI workflow.
- When changing instruction sources (`AGENTS.md`, `**/AGENTS.md`, `**/AGENTS.override.md`, `docs/frontend/mobile-ai-playbook.md`), run `pnpm ai:slop-check` locally.
- For UI changes, always save Playwright screenshots in an ignored Playwright artifacts folder, review the change via those screenshots and runtime logs, and fix it immediately if the result is not correct or not good enough.
- For frontend UI work, treat mobile as the primary design and verification target; widen to tablet and desktop only after the narrowest supported viewport is coherent.
- For frontend UI work, verify the canonical mobile matrix from `docs/frontend/mobile-ai-playbook.md`; include the additional `1280px` check when the playbook marks it as required.
- For frontend UI work, explicitly check for horizontal overflow, clipped text, obstructive sticky elements, unstable CTA placement, touch-target crowding, hover-only interactions, and short-height mobile failures such as safe-area collisions, browser-chrome resize, dynamic viewport height issues, and virtual-keyboard overlap when relevant.
- For frontend UI work, include a brief mobile QA note in the final handoff covering checked viewports, checked interaction paths or states, confirmed findings or verified states, likely risks, remaining assumptions, and the screenshot, Storybook, or Playwright evidence used.
- For runtime-sensitive route-level mobile risks, do not treat code inference alone as confirmation; use Playwright or equivalent route-level runtime evidence for confirmed findings.
- For browser-engine-sensitive mobile risks such as safe-area, browser-chrome resize, dynamic viewport height, or virtual-keyboard behavior, treat single-engine evidence as partial unless the engine limitation is stated explicitly.
- When local Playwright verification needs authenticated admin access, prefer the shared session file `output/playwright/sessions/admin.local.json`; refresh it with `pnpm playwright:session:record -- --persona admin` and validate it with `pnpm playwright:session:check -- --persona admin` using an existing local or test platform admin account.
- When sharing screenshots in chat responses, embed them inline as Markdown images using absolute filesystem paths; avoid plain linked file paths unless explicitly requested.
- `pnpm install` configures `.githooks` automatically in local Git worktrees; rerun `pnpm hooks:install` manually if hook setup drifts.

## External Service Access

- For GitHub, Vercel, and Supabase tasks in this repository, use the native CLI first: `gh`, `vercel`, `supabase`.
- For Vercel, use `findmydoc-portal` as the project name when the CLI needs an explicit project reference.
- Vercel context:
  - Team slug: `findmydoc`
  - Production domain: `https://findmydoc.eu`
  - Preview domain: `https://preview.findmydoc.eu`
  - `NEXT_PUBLIC_SERVER_URL` should be set in Vercel for `production` and `preview` with those respective domains.
  - `vercel link --yes --scope findmydoc --project findmydoc-portal` is allowed when the local workspace is not linked yet.
- Do not use Playwright, browser-based login flows, or MCP as authentication workarounds for those services.
- If CLI access or authentication is unavailable, stop and report the required setup instead of trying alternative login methods.

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
- Use only the types and scopes accepted by `.github/workflows/pr-gates.yml`; keep the title valid for `amannn/action-semantic-pull-request@v5`.
- Summary starts lowercase, imperative, and <= 72 chars.
- Start descriptions with a short user-impact sentence, then `## What changed` and `## Validation` sections.
- For UI changes, include a `Screenshots:` section with affected states.
- Keep language concise and concrete.
- Build PR descriptions in a temporary markdown file or heredoc, then pass them with `gh pr create --body-file` or `gh pr edit --body-file`.
- Never pass multiline PR bodies inline through shell quoting, and never rely on literal `\n` sequences to create paragraph breaks.
- Verify the rendered PR body with `gh pr view --json body` before sharing the link.

## Issue Workflow

- Open or reuse a GitHub Issue before creating a PR.
- Write the Issue as an existing problem, need, or opportunity; avoid future-tense implementation wording.
- Use the matching repository issue template as the body skeleton for every new issue and for any issue rewrite.
- Keep issue bodies lightweight and template-shaped; move deeper implementation detail into a linked doc instead of expanding the issue.
- Prefer `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature.yml` as the source of truth for section order and wording.
- Link the Issue in the PR `Development` section before requesting review or merge.
- AI-assisted and human-authored PRs count as non-bot and must have at least one linked Issue.
- Only GitHub bot-authored PRs, such as Dependabot, are exempt.

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

## Review Severity Scale

Use an absolute `1-10` severity scale for review findings across all agents and review tasks. Do not use relative labels such as `high`, `medium`, or `low` unless the user explicitly asks for them.

- `9-10`: production-critical or trust-critical issue; likely to break primary flows, create security exposure, or cause severe user failure
- `7-8`: important issue with clear user, business, or reliability impact; should usually be fixed before merge
- `5-6`: meaningful issue worth fixing soon; real risk exists but the impact is narrower or more conditional
- `3-4`: quality or maintainability gap; useful to improve but not urgent on its own
- `1-2`: minor polish, wording, or consistency issue with low standalone impact

For review outputs:

- score findings on this absolute scale, not relative to the other findings in the same review
- prefer fewer findings with calibrated scores over long lists of weak observations
- if nothing credibly reaches `5/10`, say that explicitly instead of inflating weaker issues

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
