---
name: gh-release-publish
description: Publish a GitHub release for the website repository by calculating the next semantic version from Conventional Commit history on `origin/main`, generating native GitHub release notes, dispatching the production deploy workflow, and sending a stakeholder-focused Google Chat webhook announcement. Use when Codex needs to create the next release tag, verify release preconditions on `origin/main`, trigger the existing production deployment, or announce a shipped release in German for non-technical colleagues.
---

# GitHub Release Publish

## Overview

Use this skill to ship a repository release end to end: fetch the latest `origin/main` state, determine the next `vX.Y.Z` tag from that remote commit history, publish the GitHub release with generated notes, wait for the production deploy workflow to finish, gather deterministic `commit -> PR -> linked issue` context for announcement drafting, and then send an explicitly drafted Google Chat announcement.

## Workflow

1. Fetch `origin/main` and tags, then treat that remote ref as the only release source of truth.
2. Compute the next semantic version from commits since the latest merged `v*.*.*` tag on `origin/main`.
3. Collect the PR/Issue source context from current commit history before the release is created.
4. Resolve PRs from the commits in the release range through GitHub metadata, not primarily from commit-subject guessing.
5. Resolve Issues only from the PR development-link / closing-issue metadata.
6. Publish a non-draft GitHub release with native generated release notes.
7. Dispatch `.github/workflows/deploy-production.yml` and wait for it to finish successfully.
8. Use the collected source context in Codex to draft the final German Google Chat message.
9. Send the final approved message explicitly through the dedicated GitHub Actions workflow that reads the repository secret.

## Required Repository Assumptions

- Require GitHub CLI authentication with `repo` and `workflow` scopes.
- Require an existing `v*.*.*` tag reachable from `origin/main`.
- Abort if the next tag or release already exists.
- Require the repository secret `GOOGLE_CHAT_WEBHOOK_URL` only for the final send step.
- Local branch, local worktree cleanliness, and local `HEAD` do not affect the release calculation as long as `origin/main` and GitHub are reachable.

## Commands

Run the scripts from the repository root:

```bash
node .codex/skills/gh-release-publish/scripts/compute-next-release.mjs
node .codex/skills/gh-release-publish/scripts/compute-next-release.mjs --json
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --dry-run
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --dry-run-json
node .codex/skills/gh-release-publish/scripts/publish-release.mjs --execute
node .codex/skills/gh-release-publish/scripts/send-google-chat-message.mjs --release-tag v0.30.0 --release-url https://github.com/findmydoc-platform/website/releases/tag/v0.30.0 --site-url https://findmydoc.eu --dry-run
node .codex/skills/gh-release-publish/scripts/send-google-chat-message.mjs --release-tag v0.30.0 --message-file output/release-chat.txt --yes
```

## Semantic Version Rules

- `BREAKING CHANGE:` footer or `type!:` header bumps `major`.
- Any `feat` commit without a breaking change bumps `minor`.
- `fix`, `perf`, `refactor`, `docs`, `ci`, `build`, `chore`, `test`, `style`, `revert`, and non-conventional commits fall back to `patch`.
- Non-conventional commits do not block the release in this repository; they are treated as `patch` unless a breaking change is explicit.
- The skill also reports a separate contextual assessment from PR and linked Issue content when the commit labels may understate the real release size.
- The contextual assessment must not silently override the technical SemVer result; both are shown side by side.

## Chat Announcement Rules

- Write the Google Chat message in German.
- Keep it readable for non-technical colleagues in a management-summary style: usually 10-16 lines.
- Read PR titles, PR bodies, linked Issue titles, and linked Issue bodies before drafting the message.
- Treat commit history only as the deterministic way to discover which PRs belong to the release.
- Use PR `What changed` sections as the main source for what shipped.
- Use Issue `Problem Statement` and `Intended Outcome` sections as the main source for why it matters.
- Let Codex evaluate the content and decide what matters; do not rely on keyword buckets or stock summary phrases.
- Lead with the live version headline, then summarize value and grouped improvements.
- Prefer visible product value over commit-level detail or raw PR/Issue listings.
- Group related changes into 2-4 user-facing bullets in changelog style.
- Mention important internal quality or regression work only as a short confidence-building line, not as tool output.
- Include links to the GitHub release and the live production site.
- Never use `@all`.
- Keep dependency, docs, and maintenance-only PRs without linked issues out of the default stakeholder narrative.
- After every dry-run handoff in Codex, always show exactly one proposed final Google Chat message that is ready to send.
- The proposed final Google Chat message must appear after the PR/Issue control list and after the deterministic source context.

## Google Chat Configuration

- Store the webhook in the repository secret `GOOGLE_CHAT_WEBHOOK_URL`.
- Create or update it with `gh secret set GOOGLE_CHAT_WEBHOOK_URL --repo findmydoc-platform/website`.
- Optionally override the live site URL with `GOOGLE_CHAT_SITE_URL`.
- The scripts default the production site URL to `https://findmydoc.eu`.
- `publish-release.mjs` and `send-google-chat-message.mjs --dry-run` print the structured PR/Issue source context for Codex drafting.
- The human dry-run output also prints an explicit `PR -> linked issues` control list with URLs so the used scope is easy to verify.
- `send-google-chat-message.mjs` requires `--message-text` or `--message-file` for the actual send and dispatches `.github/workflows/send-release-google-chat.yml`.

## Resources

- `scripts/lib.mjs`: shared helpers for Git, GitHub, semantic versioning, release-note parsing, PR/Issue drafting context, and Google Chat sending.
- `scripts/compute-next-release.mjs`: inspect commits and print the next release recommendation.
- `scripts/publish-release.mjs`: execute the full release and deploy flow via `deploy-production.yml`, then print the PR/Issue drafting context for Codex.
- `scripts/send-google-chat-message.mjs`: print drafting context in `--dry-run` or dispatch the send workflow with an explicitly provided final message after approval.

## Output Expectations

- In `--dry-run`, show the planned tag, bump reason, release range, and deployment/chat actions without mutating state.
- In `--dry-run`, also show the explicit list of used PRs and linked Issues, plus the narrowed drafting context derived from commit history and linked PR/Issue content.
- In `--dry-run`, print the planned release API payload, workflow-dispatch payloads for deploy and Google Chat send, and drafting context directly in chat/terminal instead of only storing them somewhere else.
- In `--dry-run-json`, print the same full plan as structured JSON for reuse in other automations.
- In `--execute`, fail fast on missing prerequisites before creating the release.
- After a real release, report the created release URL, watched workflow run URL, the used `PR -> linked issue` list, and the drafting context needed for the final Google Chat message.
- Only send the Google Chat message when an explicit final text is provided and the repository secret is configured.

## Codex Response Format

- When Codex reports a dry-run result in chat, always render a `Verwendete PRs und Issues` section in this exact pattern:
  - `[PR #976](https://github.com/findmydoc-platform/website/pull/976) (test: complete final public mobile regression sweep) -> [Issue #964](https://github.com/findmydoc-platform/website/issues/964) (Feature: final public mobile regression sweep)`
- If one PR closes multiple linked issues, keep the PR first and append the issues in the same line or the immediately following line, but always preserve the `PR -> Issue` relationship visibly.
- Always include the PR title and the Issue title in parentheses directly after their links.
- After the PR/Issue list, always include a `Chat-Nachricht` section with the exact message Codex would send next.
- The `Chat-Nachricht` section must be a single ready-to-send message block, not a list of options.
