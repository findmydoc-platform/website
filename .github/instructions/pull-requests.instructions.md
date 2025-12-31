---
applyTo: "**/*"
---

Write pull request titles and descriptions for this repository. Use these rules only when generating PR metadata (title/description).

Title rules:
- Format must be a Conventional Commit: `<type>(optional-scope)?: short summary`
- Allowed types: See `types` list in `.github/workflows/pr-gates.yml`.
- Allowed scopes: See `scopes` list in `.github/workflows/pr-gates.yml`.
- The summary must start with a lowercase letter (e.g. `feat: add clinic filters`).
- Use present-tense, imperative verbs and keep the title <= 72 characters.
- Provide 3 concise title options when asked.

Description rules:
- Begin with a 1–2 sentence summary of the change.
- "Changes:" list key changes as bullets (what changed, where).
- "Why:" explain the rationale in one paragraph.
- "Testing:" list manual verification or automated test steps.
- "Related:" reference issues or PRs (e.g., `Related: #123`).
- "Breaking changes:" state any migrations or consumer notes, or `None`.

Styling and voice:
- Keep language concise, professional, and in plain English.
- Avoid internal implementation details that are irrelevant to reviewers.

Examples:
- Title options:
  - feat(clinics): optimize onChange handling in clinic filters
  - refactor(clinics): reduce re-renders in ClinicFilters
  - perf(clinics): debounce onChange for filter controls

- Description:
  Summary: Optimize onChange handling in `ClinicFilters` and `ClinicComparisonFilters` to reduce re-renders and improve responsiveness.
  Changes:
  - Replace direct state updates with batched onChange handler in `src/components/...`
  - Add unit tests for filter debouncing
  Why:
  - Users experienced UI lag when toggling filters; batching reduces renders.
  Testing:
  - Run `pnpm test unit` and verify relevant tests pass.
  - Manually load clinic list and exercise filters to confirm responsiveness.
  Related: #503
  Breaking changes: None
