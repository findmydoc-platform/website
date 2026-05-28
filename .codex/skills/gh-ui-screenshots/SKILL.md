---
name: gh-ui-screenshots
description: Attach existing UI screenshots to GitHub pull request descriptions after a UI, frontend, visual, responsive, or mobile pull request has been created or updated. Use when Codex is preparing or updating a PR that needs screenshot evidence in the existing `UI/mobile QA` validation item. This skill does not create PRs, commit, push, run checks, run tests, or capture screenshots; it only uploads already available images and patches the PR body.
---

# GitHub UI Screenshots

Use this skill only after a GitHub PR exists. It is a deterministic follow-up step for UI PR descriptions.

Use the Pareto path: attach screenshots only when they already exist or are trivial to find in ignored artifacts. Do not work hard to invent screenshot evidence.

Boundary:

- PR body updates use GitHub's official REST pull request `body` update path.
- Image attachment upload uses GitHub's web comment-box attachment flow. Treat it as best-effort and private-internal, not as a stable public API.
- Stored Playwright browser state contains sensitive GitHub cookies; keep it in the skill cache and never print cookie values.

Decision:

- Existing image paths are known: run once with explicit `--image`.
- No image paths are known: run once without `--image` to scan ignored artifact folders.
- No images found: stop; leave the PR unchanged and ask the user only if screenshot evidence seems needed.
- Screenshots are not meaningful for the PR: do nothing.

## Command

Run from the repository root:

```bash
node .codex/skills/gh-ui-screenshots/scripts/attach-ui-screenshots.mjs --pr current --image output/playwright/home-mobile.png:Mobile --image output/playwright/home-desktop.png:Desktop
```

Options:

- `--pr <current|number|url>`: PR target. Default: `current`.
- `--image <path[:label]>`: Existing screenshot. Repeat for multiple images.
- `--dry-run`: Resolve PR and images without uploading or patching.
- `--bootstrap-session`: Open a browser login session and save the GitHub web cookies for later uploads.
- `--browser-channel <msedge|chrome|chromium>`: Browser channel for GitHub web session and upload-token discovery.

## Workflow

1. If screenshots already exist in the chat context, save them first into an ignored temp path such as `tmp/gh-ui-screenshots/`.
2. Run the script with explicit `--image` paths whenever possible.
3. If `--image` is omitted, the script searches only ignored artifact folders: `output/playwright`, `test-results`, `playwright-report`, and `tmp`.
4. If no image is found, stop after the script's no-op output. Do not search elsewhere.
5. If the GitHub web session is missing, run `--bootstrap-session` only after at least one image exists and should be uploaded.
6. Do not run `pnpm format`, `pnpm check`, `pnpm build`, tests, or screenshot capture as part of this skill.

## PR Body Behavior

The script updates only the PR body:

- Sets `- [ ] UI/mobile QA:` to `[x]`.
- Inserts or replaces a marker block directly below that line:
  `<!-- gh-ui-screenshots:start --> ... <!-- gh-ui-screenshots:end -->`.
- Uses GitHub user-attachment URLs for Markdown images.
- Does not add a separate `## Screenshots` section.

## Failure Rules

- If no PR is found, stop and create/open the PR first.
- If no images are found, do not fail the workflow. Leave the PR body unchanged and ask whether screenshot evidence is needed.
- If GitHub login is required, run `--bootstrap-session`; do not inspect HAR files. Bootstrap is not a discovery step; use it only when an upload is actually needed.
- Before upload, the script prints the GitHub API user and web-session status only. It does not try to hard-match the web session to the API token user because that would require another private GitHub web lookup.
- If upload internals fail, report the command and status only; do not print cookies, tokens, or raw GitHub session data.
