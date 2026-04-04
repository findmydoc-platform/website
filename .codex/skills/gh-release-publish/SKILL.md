---
name: gh-release-publish
description: Publish a GitHub release for the website repository by calculating the next semantic version from Conventional Commit history, generating native GitHub release notes, dispatching the production deploy workflow, and sending a stakeholder-focused Google Chat webhook announcement. Use when Codex needs to create the next release tag, verify release preconditions on `main`, trigger the existing production deployment, or announce a shipped release in German for non-technical colleagues.
---

# GitHub Release Publish

## Overview

Use this skill to ship a repository release end to end: validate the repo state, determine the next `vX.Y.Z` tag from commit history, publish the GitHub release with generated notes, wait for the production deploy workflow to finish, and then post a stakeholder-friendly Google Chat announcement.

## Workflow

1. Confirm the repository is on `main`, clean, and aligned with `origin/main`.
2. Compute the next semantic version from commits since the latest merged `v*.*.*` tag.
3. Preview the planned German Google Chat message from current commit history before the release is created.
4. Publish a non-draft GitHub release with native generated release notes.
5. Dispatch the existing production deploy workflow and wait for it to finish successfully.
6. Show the exact final German Google Chat message preview and ask for confirmation before sending it through the webhook.

## Required Repository Assumptions

- Only release from `main`.
- Require a clean worktree.
- Require `HEAD` to match `origin/main`.
- Require GitHub CLI authentication with `repo` and `workflow` scopes.
- Require an existing `v*.*.*` tag reachable from `main`.
- Abort if the next tag or release already exists.
- Require `GOOGLE_CHAT_WEBHOOK_URL` for the release-and-announce flow.

## Commands

Run the scripts from the repository root:

```bash
node .codex/skills/gh-release-publish/scripts/compute-next-release.mjs
node .codex/skills/gh-release-publish/scripts/compute-next-release.mjs --json
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --dry-run
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --dry-run-json
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --execute
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --dry-run --chat-headline "Freigegebene Release-Zusammenfassung" --chat-add-line "Wichtige Zusatzinfo fuer das Team."
node .codex/skills/gh-release-publish/scripts/send-google-chat-message.mjs --release-tag v0.30.0 --release-url https://github.com/findmydoc-platform/website/releases/tag/v0.30.0 --site-url https://findmydoc.eu --dry-run
```

## Semantic Version Rules

- `BREAKING CHANGE:` footer or `type!:` header bumps `major`.
- Any `feat` commit without a breaking change bumps `minor`.
- `fix`, `perf`, `refactor`, `docs`, `ci`, `build`, `chore`, `test`, `style`, `revert`, and non-conventional commits fall back to `patch`.
- Non-conventional commits do not block the release in this repository; they are treated as `patch` unless a breaking change is explicit.

## Chat Announcement Rules

- Write the Google Chat message in German.
- Keep it short and readable for non-technical colleagues: 6-10 lines.
- Lead with the live version headline, then summarize value and grouped improvements.
- Prefer visible product value over commit-level detail.
- Group many small fixes into broad improvements such as stability, clarity, or UX polish.
- Include links to the GitHub release and the live production site.
- Never use `@all`.

## Google Chat Configuration

- Configure the webhook as `GOOGLE_CHAT_WEBHOOK_URL`.
- Optionally override the live site URL with `GOOGLE_CHAT_SITE_URL`.
- The scripts default the production site URL to `https://findmydoc.eu`.
- In non-interactive runs, the scripts print the ready-to-send message and leave the final send step pending approval.
- Use `--chat-headline`, `--chat-summary`, repeated `--chat-add-line`, and repeated `--chat-remove-pattern` to tune the stakeholder message without editing the scripts.

## Resources

- `scripts/lib.mjs`: shared helpers for Git, GitHub, semantic versioning, release-note parsing, and Google Chat formatting.
- `scripts/compute-next-release.mjs`: inspect commits and print the next release recommendation.
- `scripts/publish-release.mjs`: execute the full release and deploy flow, then preview the Google Chat message and ask for confirmation.
- `scripts/send-google-chat-message.mjs`: preview and send the German webhook message from existing release notes after approval.

## Output Expectations

- In `--dry-run`, show the planned tag, bump reason, release range, and deployment/chat actions without mutating state.
- In `--dry-run`, also show the provisional Google Chat message preview derived from commit history.
- In `--dry-run`, print the planned release API payload, workflow-dispatch payload, and Google Chat message directly in chat/terminal instead of only storing them somewhere else.
- In `--dry-run-json`, print the same full plan as structured JSON for reuse in other automations.
- In `--execute`, fail fast on missing prerequisites before creating the release.
- After a real release, report the created release URL, watched workflow run URL, and the exact Google Chat message before sending it.
- Only send the Google Chat message after explicit confirmation.
