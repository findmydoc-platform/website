# Codex Specialist Subagents

This repository defines project-scoped Codex subagents for narrow review work that should not pollute the main task context.

## Why this split exists

Use the two Codex layers for different jobs:

- `AGENTS.md`: repository and path-scoped baseline rules that should always apply.
- `.codex/agents/*.toml`: explicit specialist subagents for delegated ownership of one concern.

This setup keeps specialist instructions narrow and opt-in instead of pushing SEO, accessibility, performance, or security guidance into every task.

The relevant Codex docs are:

- [Subagents](https://developers.openai.com/codex/subagents)
- [Agents SDK orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)

## Repository configuration

Project-level subagent defaults live in [`/.codex/config.toml`](../../.codex/config.toml):

- `max_threads = 4`
- `max_depth = 1`

This allows parallel review across the four specialists while preventing recursive fan-out.

The specialist files under [`/.codex/agents`](../../.codex/agents) also disable a small set of broad skills per reviewer through `skills.config` so the reviewers stay narrow.

Important:

- Some disabled skills live under the Codex plugin cache.
- Those cache paths are versioned. After a plugin refresh, the hash segment in the path may change.
- If a reviewer suddenly starts drifting again after a Codex/plugin update, refresh the affected `skills.config.path` entries.

## Available specialists

- `security_reviewer`
  - Read-only reviewer for auth, access control, unsafe input or output handling, trust boundaries, and backend security risks.
- `accessibility_reviewer`
  - Read-only reviewer for semantic HTML, keyboard behavior, focus management, form accessibility, and ARIA usage.
- `web_vitals_reviewer`
  - Read-only reviewer for LCP, INP, CLS, hydration cost, asset loading, and route-level frontend performance risks.
- `seo_reviewer`
  - Read-only reviewer for crawlability, indexation, metadata, structured data, and search-facing rendering behavior.

All four agents are intentionally read-only. They gather evidence and findings; they do not edit code.

## How to use them

Use direct prompts when you want one specialist:

```text
Have accessibility_reviewer audit the affected frontend files only and report concrete findings with file references.
```

```text
Have security_reviewer review src/app/api and src/hooks for privilege-boundary or input-validation risks only.
```

Use a direct orchestration prompt when you want multiple specialists:

```text
Review this branch against origin/main.
Spawn security_reviewer, accessibility_reviewer, web_vitals_reviewer, and seo_reviewer in parallel.
Keep them read-only, wait for all of them, and summarize the findings by severity.
```

Limit scope aggressively when possible:

- the current diff versus `origin/main`
- a named route such as `src/app/(frontend)/clinics/[slug]`
- a named component subtree such as `src/components/organisms/Form`
- a backend area such as `src/app/api` or `src/hooks`

## Recommended operating model

For review-only work:

1. Run the specialist or specialists.
2. Consolidate findings.
3. Decide whether a fix is needed.

For review plus implementation:

1. Run the specialists first.
2. Let the parent agent decide which findings are real and in scope.
3. Apply the fix in the main thread or a dedicated implementation agent.
4. Re-run only the relevant specialists to verify the changed concern.

## Why not put this in `AGENTS.md`

Putting all four specialties into the repository-wide `AGENTS.md` would make them part of nearly every task. That increases context size, causes instruction conflicts, and weakens specialist quality.

Subagents are the right layer when:

- a concern is narrow and expert-driven
- the review can run in parallel
- the result should come back as findings, not silently alter the main task behavior
