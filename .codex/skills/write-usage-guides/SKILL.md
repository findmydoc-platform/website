---
name: write-usage-guides
description: Create German, non-technical step-by-step guides for using this repository's website and Payload CMS flows, grounded in real UI behavior and Playwright screenshots. Use when Codex needs to document how to log in, navigate the admin, create or edit records such as clinics, or explain an operational website or CMS workflow for internal operators in a deterministic, screenshot-backed way.
---

# Write Usage Guides

## Overview

Use this skill to produce operator-facing usage guides for this repository. The default output is a German guide that explains one real workflow step by step, verifies the flow in the UI, and embeds only the screenshots that help a human complete the task.

## Defaults

- Write the final guide in German unless the user explicitly asks for another language.
- Write for internal operators or editorial staff unless the user names another audience.
- Address the reader with `du` by default unless the user explicitly asks for another tone.
- Prefer local or dev environments first and state the tested environment in the guide.
- Save the final guide to `docs/guides/<slug>/index.md`.
- Save final embedded screenshots to `docs/guides/<slug>/images/*.png`.
- Save iterative Playwright screenshots to `output/playwright/<slug>/*.png`.
- Reuse the shared local admin Playwright session at `output/playwright/sessions/admin.local.json` for admin workflows when it is available.
- Capture screenshots per relevant visible state change, not after every click.
- If a guide for the same workflow already exists, update it instead of creating a duplicate.

## Workflow

1. Identify the workflow to document and derive a short slug.
2. Read the nearest repository instructions before acting:
   - repository root `AGENTS.md`
   - relevant nested `AGENTS.md` files under `src/`
3. Read only the code needed to understand the flow:
   - website flows: start with `src/app/(frontend)/**`
   - Payload admin flows: start with `src/app/(payload)/**`
   - collection-specific CMS flows: add relevant `src/collections/**`
4. Create the guide scaffold before writing large content:
   - `docs/guides/<slug>/index.md`
   - `docs/guides/<slug>/images/`
   - `output/playwright/<slug>/`
5. For Payload admin workflows, verify the shared local admin session before capturing screenshots:
   - if you need a disposable local admin account, run `pnpm playwright:session:provision -- --persona admin`
   - run `pnpm playwright:session:check -- --persona admin`
   - if the session is missing or invalid, run `pnpm playwright:session:record -- --persona admin`
6. Run the flow in the browser and observe actual UI behavior.
7. Capture screenshots only for meaningful states:
   - page or section arrival
   - form states a user must recognize
   - confirmation or success states
   - important warnings or validation states
8. Discard duplicate, transitional, or purely cosmetic screenshots.
9. Write the guide from the observed UI flow, not from implementation theory.
10. If the UI differs from the code or expectation, prioritize the observed UI and mention the mismatch briefly.
11. Check `docs/guides/` for existing related guides and link them in the final guide when they genuinely help the reader continue or branch into a neighboring workflow.
12. If the flow could not be reproduced end to end, state clearly which part was verified in the UI and which later steps are based on the current repository structure.

## Guide Maintenance

When a guide already exists for the same workflow, treat maintenance as part of the job.

1. Read the existing guide first.
2. Re-check the relevant code paths and current UI flow.
3. Update the guide when the user-facing flow changed, including:
   - navigation path
   - button, tab, field, or collection names
   - prerequisites, permissions, or required seed state
   - success states, warnings, or validation behavior
4. Refresh screenshots for steps whose visible UI changed. Do not keep stale screenshots just because the step still exists.
5. Remove instructions that are no longer true.
6. Keep the same guide path when the workflow is still the same. Create a new guide only when the workflow itself is materially different.

## Writing Rules

- Use short, direct German sentences.
- Address the reader with `du`.
- Use exact UI labels as shown on screen.
- Keep each numbered step to one action or one coherent form section.
- Explain what the user should do and what they should see next.
- Avoid code blocks unless the workflow genuinely requires a command.
- Avoid implementation details, architecture, internal naming, and code-centric explanations.
- Only include prerequisites that a human operator must know before starting.
- Only include a troubleshooting section when the issue was observed in the real run.
- If part of the guide is inferred instead of browser-verified, state that briefly and plainly in `Voraussetzungen` or `Häufige Probleme`.

Read `references/writing-rules.md` before drafting or revising guide text.

## Guide Structure

Every guide should use this order:

1. Title
2. Goal / outcome
3. Prerequisites
4. Step-by-step instructions
5. Verification result
6. Related guides, only if relevant guides already exist
7. Common problems, only if observed

Read `references/guide-template.md` before creating the final markdown.

## Screenshot Rules

- Prefer viewport screenshots that keep the relevant controls visible.
- Name screenshots in execution order, for example `01-login-page.png`, `02-dashboard.png`.
- Store raw captures in `output/playwright/<slug>/`.
- Copy only the screenshots that are used in the final guide to `docs/guides/<slug>/images/`.
- Reference embedded screenshots with relative markdown paths from the guide file.
- Dismiss cookie banners or other overlays before capturing, unless the overlay itself is part of the guide.
- If a screenshot contains sensitive data, redact it before using it or omit it.
- Shared local session files are reusable for screenshots, manual QA, and exploratory Playwright runs, but they are not CI fixtures and must never be committed.
- If you provisioned a disposable local admin account for the run, delete it afterwards with `pnpm playwright:session:cleanup -- --persona admin`.

## Blockers

Stop and ask the user when any of the following is missing or unsafe to assume:

- login credentials
- local app or dev server access
- required seed data
- required permissions or roles
- a stable environment where the flow can be reproduced

Do not invent hidden form values, IDs, or permissions just to finish the guide.

## Repository-Specific Notes

- This repository normally keeps documentation in English, but user-facing operational guides created with this skill are intentionally German by default.
- `output/playwright/` is already an ignored artifact directory and should be used for iterative browser captures.
- When documenting Payload admin workflows, validate the visible admin flow with screenshots for key states as required by repository guidance.

## Resources

- `references/writing-rules.md`: tone, wording, and non-technical writing constraints for German operator guides.
- `references/guide-template.md`: canonical markdown structure and screenshot placement rules.
- `scripts/init_guide.py`: scaffold a deterministic guide folder, image folder, raw screenshot folder, and starter markdown file.
