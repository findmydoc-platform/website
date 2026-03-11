---
name: gh-pr-conventional-flow
description: Create and prepare Git branches, commits, pushes, and draft pull requests with GitHub CLI using feature/hotfix branch conventions and Conventional Commit metadata. Use when asked to turn local changes into a commit and draft PR with standardized naming, context-aware fix-vs-feature typing, and detailed PR body updates.
---

# GH PR Conventional Flow

## Objective

Package local repository changes into a clean branch, one Conventional Commit, and a draft pull request with consistent metadata.

## Preflight

1. Verify GitHub CLI is installed:
   - Run `gh --version`.
   - If missing, stop and ask the user to install `gh`.
2. Verify authentication:
   - Run `gh auth status`.
   - If unauthenticated, stop and ask the user to run `gh auth login`, then rerun `gh auth status`.

## Determine Change Type

Classify the work before naming branches and messages.

- Use `fix` only when correcting broken behavior, regressions, defect-caused test failures, or security/stability bugs.
- Use `feat` for all non-bugfix work.
- If ambiguous, inspect request intent, issue context, and behavior before/after the change. Do not decide based on diff size.

Derive:

- `change_type`: `fix` or `feat`
- `branch_prefix`: `hotfix` for `fix`, otherwise `feature`

## Select Core Summary

Build title and commit text from the intentional core component, not from the largest changed file.

1. Review changed files.
2. Exclude generated or derived artifacts from summary selection (for example generated code, lockfiles, snapshots, compiled output, or large machine-generated scripts).
3. Identify the principal module where the behavior change is intentionally implemented.
4. Write a concise, lowercase, imperative summary tied to that core module and user outcome.

Examples:

- `fix: prevent clinic filter reset on route change`
- `feat: add treatment comparison sorting controls`

## Branch Workflow

1. Resolve current branch: `git branch --show-current`.
2. Resolve default branch (`main`, `master`, or remote default branch).
3. If currently on the default branch, create a new branch:
   - `git checkout -b "<branch_prefix>/<description-slug>"`
4. If already on a non-default branch, stay on the current branch.

Slug rules:

- lowercase words separated by `-`
- remove punctuation
- keep concise and core-focused

## Commit Workflow

1. Confirm status: `git status -sb`
2. Stage all changes: `git add -A`
3. Commit with Conventional Commit format and no scope:
   - `git commit -m "<change_type>: <core summary>"`

Never add a scope unless explicitly requested.

## Checks Workflow

1. Run required checks if they were not already run.
2. If checks fail because dependencies or tools are missing, install prerequisites and rerun checks once.
3. If checks fail due to real issues, fix them and rerun checks.

## Push Workflow

1. Push with tracking:
   - `git push -u origin $(git branch --show-current)`
2. If push fails due to workflow auth or branch sync issues, pull from the default branch and retry:
   - `git pull --rebase origin <default-branch>`
   - rerun push command

## Pull Request Workflow

1. Create draft PR non-interactively:
   - `GH_PROMPT_DISABLED=1 GIT_TERMINAL_PROMPT=0 gh pr create --draft --fill --head $(git branch --show-current)`
2. Set PR title as Conventional Commit without scope:
   - `<change_type>: <core summary>`
3. Write PR body to a temporary markdown file and update via `--body-file` to preserve real newlines.
4. Ensure PR description includes:
   - issue context and user impact
   - root cause
   - fix summary
   - validation steps and results
5. For UI changes, ensure `Screenshots:` contains rendered images with GitHub-hosted URLs.
6. Do not leave local or relative screenshot links in the PR body (`tmp/...`, `./...`, `/Users/...` are invalid for reviewers).
7. Reliable upload flow for local screenshots:
   - create or update PR body via CLI first
   - run `gh pr view --web`
   - edit the PR description in GitHub web UI and paste or drag/drop screenshots into `Screenshots:`
   - save and verify image rendering from GitHub-hosted URLs

## UI Screenshot Upload (Mandatory for UI PRs)

### Contract

- Inputs:
  - `pr` (optional): PR number or URL. Defaults to the PR of the current branch.
  - `screenshot_paths[]` (required for UI changes): absolute local file paths.
  - `ui_change` (optional): `auto` (default), `true`, or `false`.
- Outputs (JSON):
  - Success: `{ ok: true, pr: { number, url }, uploaded_urls: string[] }`
  - Failure: `{ ok: false, error: { reason, next_step, details? } }`

### Enforcement

- If UI change is detected (`ui_change=auto` heuristic or `ui_change=true`), the flow fails hard when:
  - `Screenshots:` section is missing or empty
  - local/relative paths are present (`tmp/...`, `./...`, `/Users/...`)
  - image URLs are not GitHub-hosted upload URLs

### Command

```bash
node .github/skills/gh-pr-conventional-flow/scripts/pr-screenshot-upload.mjs --pr <number-or-url> --ui-change auto --headless --screenshot /absolute/path/one.png --screenshot /absolute/path/two.png
```

### Skill-Local Tests

```bash
node --test .github/skills/gh-pr-conventional-flow/tests/pr-screenshot-upload-lib.test.mjs
```

### Operational Flow

1. Resolve PR (`gh pr view`) and changed files (`gh pr diff --name-only`).
2. Detect UI change heuristically unless overridden via `--ui-change`.
3. Ensure `Screenshots:` section exists in PR body.
4. Open PR page with Playwright, enter description edit mode, upload screenshots via file input, save.
5. If browser edit is unavailable (for example missing web session), fallback uploads screenshots via `gh gist create` and injects raw gist URLs into `Screenshots:`.
6. Re-read PR body and verify only GitHub-hosted image URLs are present in `Screenshots:`.
7. Return structured JSON or fail with actionable error message.
