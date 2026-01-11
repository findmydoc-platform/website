---
name: issue-gap-analysis
description: Audit GitHub issues, categorize by type, flag project coverage or gaps, evaluate staleness, and produce a local execution + reintegration plan that aligns issue requirements with implemented work.
---

# Issue Inventory & Gap Analysis

## Purpose
Given a GitHub repository (and optional label or milestone filters), inspect issues to understand their types, whether they belong to any Projects, if they are outdated, and how their requirements compare to the current codebase. Produce a plan that can be executed locally before syncing results back to GitHub, including a gap analysis between implemented functionality and open issue expectations.

**Primary outcomes:**
- A scoped inventory of issues (with project coverage + staleness).
- A per-issue “fit vs gap” assessment grounded in concrete evidence.
- A local execution plan (code/tests/docs) + a GitHub reintegration plan (issue updates).

**Constraints:**
- Use GitHub MCP tools for all GitHub data access and issue updates.
- Use web/documentation search only to verify external facts (e.g., GitHub API semantics, best practices), never as a substitute for inspecting the repo and issues.
- Do not invent requirements: every requirement must be traceable to issue title/body/comments or referenced docs/ADRs.

## How to run this skill (step-by-step)
This is the execution plan. Follow it in order and stop early when a stop-condition triggers.

1. **Set scope (stop-condition: scope undefined)**
   - Confirm: repo, `open` vs `all`, filters (labels/milestone/project), and stale threshold.
   - Confirm the code reference for “implemented”: default branch vs a specific commit/branch.

2. **Fetch the working set (stop-condition: 0 issues)**
   - Use GitHub MCP issue search/list to fetch all matching issues.
   - Capture at minimum: `#`, title, state, type/labels, assignees, milestones, updated time, and project membership.

2.5 **Create an editable report file (stop-condition: file created)**
   - Create (or update) a workspace Markdown file intended for manual edits.
   - The report MUST include issue numbers (e.g., `#123`) so it can be used later to update issues.
   - Recommended path: `.github/skills/issue-gap-analysis/runs/issue-gap-report-<YYYYMMDD-HHMM>.md` (one file per run).
   - Seed it from the template at `.github/skills/issue-gap-analysis/issue-gap-report.template.md`.

3. **Build the inventory table (stop-condition: table complete)**
   - Populate the Issue Inventory Table in the report file first. It becomes the index for everything else.

4. **Extract requirements per issue (stop-condition: requirements unclear → mark `needs verification`)**
   - From issue body + comments, extract:
     - expected behavior (what “done” means)
     - acceptance criteria / checklists
     - constraints (env, roles, permissions, data)
   - If the issue lacks minimum info, do not guess. Mark as `needs verification` and request missing info.

5. **Collect evidence (stop-condition: no evidence found → `unimplemented`)**
   - Find PRs/commits/code references connected to the issue.
   - Prefer merged PRs or commits on the target ref.
   - Record evidence links and a short justification (“this code path satisfies AC-2 because …”).

6. **Decide status (stop-condition: status assigned)**
   - Assign exactly one: `implemented` | `partially implemented` | `unimplemented` | `needs verification`.
   - Use the evidence rubric below; do not mark `implemented` without verification.

7. **Create a local execution plan (stop-condition: no gaps)**
   - Only for `partially implemented`, `unimplemented`, or `needs verification` issues.
   - The plan must include repo-specific commands (`pnpm check`, `pnpm tests`, etc.) and the files/areas likely to change.

8. **Prepare GitHub reintegration actions (stop-condition: proposed updates drafted)**
   - For each issue: propose concrete updates (comment, label/type, project status, close reason).
   - Prefer commenting with evidence even when closing.
   - Record proposed updates per issue in the report file under “Proposed GitHub updates”.

## Inputs
- Repository identifier (owner/name) or remote URL.
- Optional filters: labels, milestones, assignees, search query, or project ID.
- Optional “stale days” threshold (default: 30) for outdated detection.
- Optional branch or commit reference representing the local implementation state for gap analysis.

## Repository specifics (findmydoc-portal)
Use these repo conventions to make the analysis concrete and consistent.

**Stack & constraints (high signal):**
- PayloadCMS v3 is the source of truth for content, validation, and business logic.
- Next.js App Router is a thin consumer (avoid client-side business validation).
- Supabase provides auth; access and scoping are centralized under `src/access/**`.
- No raw SQL / no drizzle: schema changes must go through Payload migrations.
- Soft delete exists (`trash: true`) and must be respected.
- TypeScript: do not use `any`.

**GitHub issue types available in this org (use for typing when labels are weak):**
- `Initiative` (management-only; MUST NOT be created/used in this repository; may appear only via linked projects)
- `Epic` (groups multiple features/tasks)
- `Feature` (new functionality request)
- `Bug` (unexpected behavior)
- `Task` (specific piece of work)

**Key code areas to map issues → evidence:**
- Payload schema & access: `src/collections/**`, `src/access/**`, `src/globals/**`
- Hooks & side-effects: `src/hooks/**` and `src/collections/**/hooks/**`
- Seeds: `src/endpoints/seed/**` + docs: `docs/seeding.md`
- Migrations: `src/migrations/**`
- Frontend UI rules: `src/app/**`, `src/components/**`, `docs/frontend/**`
- Permission matrix: `docs/security/permission-matrix.json` + tests: `tests/unit/access-matrix/**`

**UI primitives (shadcn):**
- Registry: `@shadcn` only.
- Components alias: shadcn primitives land in `src/components/atoms` (see `components.json`), imported via `@/components/atoms/<component>`.

**Repo verification commands (use in Local Work Plan):**
- Typecheck + lint: `pnpm check`
- Tests (Vitest): `pnpm tests`
- Permission matrix alignment: `pnpm matrix:verify` (required when access/matrix changes)
- Payload types: `pnpm generate`
- Migrations: `pnpm payload migrate:create <name>` then `pnpm migrate`

## Recommended prerequisites (repo-aware)
- Read relevant instruction files under `.github/instructions/` before making repo-specific conclusions.
- Identify the “source of truth” for requirements when applicable (e.g., ADRs, docs, or the issue itself).
- If the request includes code changes, confirm the testing + migration workflow used in the repository.

**High-signal docs for this repo (read when relevant to the issue):**
- `docs/setup.md` (env + migrations workflow)
- `docs/seeding.md` (baseline vs demo rules)
- `docs/security/permission-matrix.md` and `docs/security/permission-matrix.generated.md` (policy intent + generated view)
- ADRs under `docs/adrs/` (especially auth, API layer, frontend architecture)

## Data Collection (GitHub MCP ONLY)
1. Use GitHub MCP issue list/search endpoints to fetch:
   - Issue metadata (title, number, state, labels, assignees, milestones, updatedAt, createdAt).
   - Linked Projects/Project items (project titles, statuses, field values).
   - Issue comments for requirement context.
2. When comparing to implementation status, gather evidence from:
   - PRs: `mcp_io_github_git_search_pull_requests` (e.g., `linked:pr`, keywords, or issue references like `#123`).
   - Commits: `mcp_io_github_git_list_commits` for the relevant branch/tag/sha.
   - Code: `mcp_io_github_git_search_code` for key symbols/strings referenced in issues.
   - (Optional) currently-visible PR context: `github-pull-request_openPullRequest`.
3. Use `vscode-websearchforcopilot_webSearch` and/or `mcp_ref_tools_ref_search_documentation` only to validate external claims (e.g., GitHub issue close reasons), and include links + short excerpts when doing so.

## Evidence rubric (how to decide “implemented”)
Use this rubric to avoid false positives:

- Strong evidence (can justify `implemented` when requirements match):
   - A merged PR that explicitly references the issue and includes relevant code changes.
   - Tests that cover the behavior (unit/integration) and pass in CI or locally.
- Medium evidence (usually `partially implemented` or `needs verification`):
   - Code exists but lacks tests and/or doesn’t cover all acceptance criteria.
   - PR exists but is unmerged or targets a different branch than your chosen reference.
- Weak evidence (do not mark implemented):
   - Comments claiming something is done without PR/commit/code pointers.
   - Similar-looking code elsewhere without proof it satisfies the requirement.

## Query cookbook (repeatable searches)
Use these patterns when gathering evidence:

- Find issues by type/label:
   - `repo:findmydoc-platform/website is:issue is:open label:bug`
   - `repo:findmydoc-platform/website is:issue is:open label:triage`
- Find PRs that mention an issue number:
   - `repo:findmydoc-platform/website is:pr "#<issue-number>"`
   - `repo:findmydoc-platform/website is:pr is:merged "#<issue-number>"`
- Find code by domain keyword:
   - Search for collection slugs, access helpers, endpoint paths, or UI component names.

If you include these queries in output, also state which MCP tool executed them.

## Scoping & Deduping rules
Before analysis, prevent false work by normalizing the scope:
- Ensure the scope is explicit: open issues only vs all issues, labels/milestones/projects, and the code reference (default branch vs a specific ref).
- Detect duplicates: same root cause, same feature request, or superseded by a newer issue/PR.
- Prefer one canonical issue for a topic; recommend closing others as `duplicate` with cross-links.

## Analysis Workflow
1. **Normalize Scope**
   - Confirm repo, filters, and stale threshold.
   - If no issues match the scope, report that explicitly and stop.
2. **Issue Typing**
   - Prefer explicit GitHub issue type (`Bug`, `Feature`, `Task`, `Epic`) when available.
   - **Do not assign or recommend `Initiative` in this repository.** If an issue is linked to an `Initiative` via Projects, treat it as management context only and keep the repo issue typed as `Epic`/`Feature`/`Task`/`Bug` as appropriate.
   - Otherwise classify by label taxonomy (e.g., `bug`, `feature`, `documentation`, `chore`). If labels are missing, infer from title/body and note the inference.
3. **Project Coverage**
   - For each issue, list associated Projects (v1/v2) and key fields (status, iteration). Flag issues with no project membership.
4. **Staleness Check**
   - Compare `updatedAt` against the stale threshold. Mark stale issues and note number of days since last update.

   **Best-practice note:** staleness is a prioritization signal, not an automatic closure decision. Close only when you can justify a close reason.
5. **Gap Analysis**
   - Extract requirements from:
     - Issue body (acceptance criteria, checklists, expected behavior).
     - Comments from maintainers/stakeholders (decisions, clarifications).
     - Linked PRs/commits (what actually landed).
     - Repo docs/ADRs if the issue references them.
   - Map each requirement to evidence:
     - “Where in code” (file/symbol path; link to commit/PR if available).
     - “How verified” (test name, manual reproduction steps, CI check).
   - Categorize each issue as exactly one:
     - `implemented` (requirements met and verified),
     - `partially implemented` (some requirements met; list gaps),
     - `unimplemented` (no evidence of implementation),
     - `needs verification` (evidence unclear or requires runtime confirmation).
   - Prefer concrete, falsifiable statements (e.g., “no unit test covers X” vs “seems incomplete”).
6. **Local Work Plan**
   - For gaps or stale issues, craft a step-by-step local execution plan:
     1. Preparation (branching strategy, syncing main).
     2. Implementation tasks grouped by priority (correctness/security first).
     3. Verification plan (tests, linters) aligned with repo standards.
     4. Documentation or requirement updates needed.

   **Repo-specific verification rules of thumb:**
   - Access/control work: include `pnpm matrix:verify` and relevant unit tests.
   - Payload schema changes: include migration creation + `pnpm migrate` and `pnpm generate` when types are impacted.
   - UI component changes: keep the CMS/UI boundary (blocks adapt Payload → UI), and add/update stories if required by UI guidance.
7. **Reintegration Guidance**
   - Outline how to push local work back to GitHub: branch naming, PR checklist, and which issues should be updated.
   - Include recommended issue changes (labels/milestone/project/status/assignees) and the rationale for each.
   - If closing an issue, include the appropriate close reason (GitHub supports `completed`, `not_planned`, `duplicate`).

## Issue update guidance (what to change, when)
Prefer updating issues as part of reintegration so the repo stays aligned.

**When to comment (most common):**
- To add evidence (“implemented in PR #X”, “covered by test Y”).
- To clarify requirements (“confirm expected behavior under Z”).
- To propose splitting a too-large issue into smaller ones.

**When to relabel / retitle:**
- To make the type unambiguous (`bug` vs `feature` vs `docs`).
- To reflect current status (`triage`, `blocked`, `needs reproduction`, `needs decision`).

**When to close (and which reason):**
- `completed`: requirements are met and verified.
- `duplicate`: superseded by another issue/PR; link to the canonical one.
- `not_planned`: valid idea but intentionally out of scope (state rationale must be explicit).

## Minimum-info checklist (to move an issue out of `needs verification`)
If information is missing, ask for it explicitly in a comment.

- For bugs:
   - expected vs actual behavior
   - minimal reproduction steps
   - environment (local vs Vercel, browser/device, user role)
   - screenshots/logs when relevant
- For features:
   - acceptance criteria (“done means …”)
   - who can do what (roles/permissions)
   - content model implications (Payload collections/fields)
   - UX constraints (RSC vs client, atoms/molecules boundary)

## Closing decision checklist
Before recommending a close:
- Can we cite evidence (PR/commit/code/tests) for `completed`?
- Is there a canonical issue/PR for `duplicate` and have we linked it?
- Is `not_planned` an explicit product decision (and documented in the issue comment)?
- Did we avoid assigning the `Initiative` issue type in this repo?

## Templates

### Gap analysis comment template (issue)
Summary:
- Current status: implemented | partially implemented | unimplemented | needs verification

Evidence:
- PR/commit: <link>
- Code: <path / symbol>
- Tests: <test name(s)> (or “none yet”)

Gaps / follow-ups:
- [ ] <remaining requirement>

Next actions:
- <who does what next>

### Duplicate close comment template
Closing as duplicate of <link to canonical issue>.

If you think this is not a duplicate, please comment with:
- expected behavior
- current behavior
- minimal reproduction steps

## Output Format
0. **Editable report file**
   - Primary artifact (per-run): `.github/skills/issue-gap-analysis/runs/issue-gap-report-<YYYYMMDD-HHMM>.md`.
   - The user may edit run files manually; they are intended as transient run artifacts and are gitignored by default.
   - Every issue section MUST include the issue number in the heading (`### #123 — title`).
1. **Issue Inventory Table**
   - Columns: `#`, `title`, `type`, `state`, `project(s)`, `status/column`, `updated_at`, `stale? (Y/N)`.
2. **Project Coverage Summary**
   - Totals for issues inside projects vs outside, plus per-project counts.
3. **Outdated Issues List**
   - Bullet list with issue number, title, days stale, and recommended next action.
4. **Gap Analysis**
   - For each issue, state `implementation status`, cite supporting files/commits, and list unmet requirements.
5. **Local Execution Plan**
   - Ordered steps (with owners if provided) covering implementation, testing, documentation, and reintegration.
6. **Next Steps Checklist**
   - Items to update on GitHub (issue comments, project status changes, requirement docs) after local work completes.

## Quality bar (avoid common failure modes)
- Don’t treat “stale” as “invalid”: stale is a prioritization signal, not correctness.
- Don’t mark as “implemented” without evidence (PR/commit + code pointer + verification).
- Don’t rewrite issue requirements: propose edits, but keep the original intent explicit.
- Prefer small, actionable follow-ups over vague “needs work”.

## Confirmation & Follow-up
- After presenting the analysis and plan, ask the user if they want to proceed with executing the plan or adjust filters/thresholds.
- If implementation is requested, restate the agreed plan, execute changes, run the relevant tests (`pnpm check`, targeted suites, etc.), and report results back through GitHub MCP (issue comments, PR updates).
