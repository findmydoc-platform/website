# Codex Instruction Router

## Canonical Source

- Canonical project instructions for Codex are layered `AGENTS.md` files resolved by repository path.

## Repo-Local Skills

- Use `.codex/skills/gh-release-publish` when the task is to compute the next semantic release, publish a GitHub release, dispatch the production deploy workflow, or send the release announcement to Google Chat.
- Use `.codex/skills/gh-ui-screenshots` after creating or updating a UI/frontend PR when existing screenshots should be attached to the PR body; keep screenshot evidence in `UI/mobile QA`, not in a standalone screenshots section.

## Repo-Local Codex Config

- Stable command guardrails live in `.codex/rules/`; Codex hooks are intentionally not part of the v1 repo-local Codex setup.

## Repo-Local Agents

- Read-only specialist agents live under `.codex/agents/`; after local validation and before final handoff, identify every matching reviewer and recommend that set briefly to the user instead of running it automatically: instruction quality for `AGENTS.md`, `.codex/agents`, `.codex/rules`, `.codex/skills`, and AI governance docs; mobile UI for frontend UI/responsive/touch changes; accessibility for semantics/keyboard/focus/forms/dialogs/ARIA; security for access/auth/secrets/hooks/API/server trust boundaries; SEO for metadata/headings/canonicals/robots/sitemap/redirects/structured data/indexation; web vitals for image-heavy/animation-heavy/landing-page/bundle/hydration/LCP/INP/CLS-sensitive frontend changes; and Storybook for `.storybook/**`, story files, Storybook MSW handlers, Storybook Vitest config, or story-governance changes.
- Run those reviewers only after explicit user confirmation, and after a reviewer run, present all findings before making fixes so the user can confirm the fixing step.
- Treat findings with severity `6/10` or higher as fix-before-handoff; treat `5/10` as a documented user decision gate; document skipped or declined reviewers with concrete reasons.
- When instruction surfaces change, include `agent_instruction_reviewer` in the recommended reviewer set after `pnpm ai:slop-check` and before PR/final handoff; skip it for ordinary app-code changes with no instruction surface.

## Layered Instruction Map

- This map lists the active repository instruction layers; use `rg --files -g 'AGENTS.md' -g 'AGENTS.override.md'` when path-specific discovery must be exhaustive.
- Repository-wide routing and execution constraints: `AGENTS.md`
- Documentation defaults: `docs/AGENTS.md`
- Application-wide engineering defaults and analytics: `src/AGENTS.md`, `src/posthog/AGENTS.md`
- UI/frontend and CMS boundary mapping: `src/components/AGENTS.md`, `src/app/(frontend)/AGENTS.md`, `src/blocks/AGENTS.md`, `src/app/AGENTS.md`, `src/stories/AGENTS.md`
- Mobile-first frontend heuristics and prompt scaffolding: `docs/frontend/mobile-ai-playbook.md`
- AI instruction quality: `docs/engineering/ai-anti-slop-playbook.md`, `docs/engineering/agent-instruction-review-playbook.md`
- Payload/API/hooks/seeds: `src/collections/AGENTS.md`, `src/hooks/AGENTS.md`, `src/endpoints/seed/AGENTS.md`, `src/app/api/AGENTS.md`
- Payload admin UI design: `src/app/(payload)/AGENTS.md`, `src/components/organisms/AdminBranding/AGENTS.md`, `src/components/organisms/DeveloperDashboard/AGENTS.md`, `src/dashboard/adminDashboard/AGENTS.md`
- Tests: `tests/AGENTS.md`, `tests/e2e/AGENTS.md`, `tests/e2e/admin/AGENTS.md`, `tests/e2e/helpers/AGENTS.md`

## Instruction Design Principles (AI-Slop v2)

1. Prefer hierarchy over volume: prioritize P0/P1/P2 rules.
2. Keep constraints minimal and precise; avoid overloading prompts.
3. Remove conflicts across instruction files.
4. Use short examples only when they materially reduce ambiguity.
5. Scope rules through nested `AGENTS.md` files; avoid unnecessary global rules.

## Execution Requirements (Repository-Specific)

- Always read layered `AGENTS.md` instructions first.
- Prefer descriptive long-form CLI flags over short aliases whenever the CLI provides them.
- Validation policy is path-based:
  - `pnpm format` runs for every change because it is fast and deterministic.
  - `pnpm check` is required when code, hooks, runtime configuration, schema, or lint-relevant files change.
  - `pnpm build` runs when build-relevant sources (Next.js/Storybook entry points, Payload config, routing, or tooling that affects the output) change; skip it for pure docs/content edits.
  - CI-critical only changes (`.github/workflows/**`, `.github/scripts/**`, `scripts/**`) still need `pnpm check` + `pnpm format`.
  - Light-only docs/instruction changes that do not touch runtime code can omit build/check but must still run `pnpm format`.
- Before creating any git commit that changes tracked files, run `pnpm format` first, even for docs-only or test-only work.
- If required `check` or `build` fails, fix first, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and network access to the Postgres Docker DB.
- Keep `detect-secrets` and `.secrets.baseline` in sync with the branch before push; include baseline drift in the same change set so CI `Detect secrets` does not fail.
- AI-slop enforcement mode is `pre-commit + pre-push + deep-quality-lane`; AI-slop itself remains intentionally non-blocking in the main PR CI workflow.
- When changing instruction sources (`AGENTS.md`, `**/AGENTS.md`, `**/AGENTS.override.md`, `docs/frontend/mobile-ai-playbook.md`, `docs/engineering/*ai*playbook.md`, `docs/engineering/*instruction*playbook.md`, `.codex/agents/**`, `.codex/rules/**`, `.codex/skills/**`), run `pnpm ai:slop-check` locally.
- For UI changes, always save Playwright screenshots in an ignored Playwright artifacts folder, review the change via those screenshots and runtime logs, and fix it immediately if the result is not correct or not good enough.
- For frontend UI work, treat mobile as the primary design and verification target; widen to tablet and desktop only after the narrowest supported viewport is coherent.
- For frontend UI work, verify the canonical mobile matrix from `docs/frontend/mobile-ai-playbook.md`; include the additional `1280px` check when the playbook marks it as required.
- For frontend UI work, explicitly check for horizontal overflow, clipped text, obstructive sticky elements, unstable CTA placement, touch-target crowding, hover-only interactions, and short-height mobile failures such as safe-area collisions, browser-chrome resize, dynamic viewport height issues, and virtual-keyboard overlap when relevant.
- For frontend UI work, include a brief mobile QA note in the final handoff covering checked viewports, checked interaction paths or states, confirmed findings or verified states, likely risks, remaining assumptions, and the screenshot, Storybook, or Playwright evidence used.
- For runtime-sensitive route-level mobile risks, do not treat code inference alone as confirmation; use Playwright or equivalent route-level runtime evidence for confirmed findings.
- For browser-engine-sensitive mobile risks such as safe-area, browser-chrome resize, dynamic viewport height, or virtual-keyboard behavior, treat single-engine evidence as partial unless the engine limitation is stated explicitly.
- When local Playwright verification needs authenticated admin access, prefer the shared session file `output/playwright/sessions/admin.local.json`; refresh it with `pnpm playwright:session:record -- --persona admin` and validate it with `pnpm playwright:session:check -- --persona admin` using an existing local or test platform admin account.
- When sharing screenshots in chat responses, embed them inline as Markdown images using absolute filesystem paths; avoid plain linked file paths unless explicitly requested.
- `pnpm install` configures Git hooks under `.githooks` automatically in local Git worktrees; rerun `pnpm hooks:install` manually if hook setup drifts.

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

- Title format: `<type>(optional-scope)?: short summary`; use only the types/scopes accepted by `.github/workflows/pr-gates.yml`; summary starts lowercase, imperative, and <= 72 chars.
- Use `.github/pull_request_template.md` and start with a bilingual `Management summary`: one non-technical German paragraph followed by the same non-technical English paragraph, release-note quality, focused on visible product, operator, or business value.
- Keep implementation detail in `## What changed`; include architectural or module-level context, link files only when useful for review, and do not paste code snippets into the PR body.
- In `## Validation`, check every relevant item and explain every unchecked, skipped, or not-applicable item directly in the section.
- In `## Development`, use `Closes` for every linked Issue, one line per Issue. Use `Closes #123` for same-repository Issues and `Closes findmydoc-platform/management#123` for trusted cross-repository Issues.
- Do not require a standalone `Screenshots:` section by default; record UI evidence in the `UI/mobile QA` validation item. For UI PRs with existing screenshots, use `.codex/skills/gh-ui-screenshots` so screenshot attachments are inserted there idempotently.
- Build PR descriptions in a temporary markdown file or heredoc, pass them with `gh pr create --body-file` or `gh pr edit --body-file`, never inline multiline bodies through shell quoting, and verify the rendered body with `gh pr view --json body`.

## Issue Workflow

- Open or reuse a GitHub Issue before creating a PR.
- Write the Issue as an existing problem, need, or opportunity; avoid future-tense implementation wording.
- Use the matching repository issue template as the body skeleton for every new issue and for any issue rewrite.
- Keep issue bodies lightweight and template-shaped; move deeper implementation detail into a linked doc instead of expanding the issue.
- Prefer `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature.yml` as the source of truth for section order and wording.
- Link the Issue in the PR `Development` section before requesting review or merge.
- Strategic parent planning issues usually live in `findmydoc-platform/management`; implementation issues usually live in `findmydoc-platform/website`; for cross-repository parent/child links, use the global `gh-issue-relationships` skill to set and verify the real GitHub Issue Relationship instead of relying on a body-only link.
- AI-assisted and human-authored PRs count as non-bot and must have at least one linked Issue; only GitHub bot-authored PRs, such as Dependabot, are exempt.

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
