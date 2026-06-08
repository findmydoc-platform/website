## Management summary

### Deutsch

<!-- Write one non-technical paragraph in German. Focus on what improves for users, operators, or the business. Keep it useful as release/changelog source material. Do not mention implementation details, files, commits, tools, tests, issue numbers, or code snippets. -->

### English

<!-- Write the same non-technical summary in English. Focus on stakeholder-visible value, not implementation detail. Do not mention implementation details, files, commits, tools, tests, issue numbers, or code snippets. -->

## What changed

<!-- Technical and architectural overview. Explain affected flows, modules, behavior changes, and review-relevant context. Link files only when they materially help review. Do not paste code snippets. -->

-

## Points to review

<!--
Help reviewers spend attention where human judgment matters most.

Include only concrete focus areas from this PR. Do not list every generic review category.
Prefer 1-5 rows. If there is nothing special beyond normal review, write:
`None beyond standard review.`
Replace the placeholder row below; do not leave `path/to/file.ts` in the final PR.
This section guides review attention, but it does not replace normal review of all changed code.

Each row must name:
- exact files, folders, or diff regions
- why this area is review-relevant
- what the reviewer should verify
- what evidence already exists, or `Not yet covered`

Priority guide:
- P1: could affect security, privacy, data integrity, CI gates, migrations, production deploys, or primary user flows
- P2: could affect maintainability, UX quality, accessibility, performance, or important edge cases
- P3: useful reviewer context, but unlikely to block merge alone

Use this section especially for changes touching auth, access control, privacy, secrets, logging,
API/server trust boundaries, Payload schema/migrations, existing-data compatibility,
CI/workflow/build/test/coverage gates, dependencies, lockfiles, external integrations,
user-facing UI, mobile behavior, accessibility, SEO, web vitals, or complex business logic.
-->

| Priority | Files / paths     | Why focus here                               | Reviewer should verify          | Evidence                                     |
| -------- | ----------------- | -------------------------------------------- | ------------------------------- | -------------------------------------------- |
| P1/P2/P3 | `path/to/file.ts` | Short concrete risk, not a generic category. | Specific question for reviewer. | Test, screenshot, log, or `Not yet covered`. |

## UI/UX

<!-- Optional. Include only for UI, frontend, visual, responsive, or mobile changes. Add screenshots here, grouped by state and viewport with short third-level headings such as `### Homepage mobile` or `### Error state desktop`. Do not put screenshots inside `## Validation`; keep the `UI/mobile QA` validation item as a text summary and reference this section. Remove this section for non-UI changes. -->

## Validation

<!-- Check every relevant item. If an item was not run or is not applicable, leave it unchecked and explain why after the colon. -->

- [ ] `pnpm format`:
- [ ] `pnpm check`:
- [ ] `pnpm build`:
- [ ] Focused tests:
- [ ] UI/mobile QA:
- [ ] Security/privacy review:
- [ ] Migration/schema check:
- [ ] Documentation/instructions check:

## Risk and rollout

<!-- State user-facing risks, data/config/env changes, migration requirements, rollback notes, or `None known`. -->

## Development

<!-- Required. Use `Closes` for every linked issue so GitHub shows this pull request in the issue Development section and closes the issue when this pull request merges into the default branch. Same repo: `Closes #123`. Cross repo: `Closes findmydoc-platform/management#123`. Repeat `Closes` once per issue. Do not use plain issue links here. -->

Closes #
