---
applyTo: '**/*'
---

# Pull Request Metadata Rules

Scope exception: Global scope is intentional because PR title/description generation is repository-wide behavior.

## Priorities

- `P0`: Correct Conventional Commit title format.
- `P1`: Clear end-user impact summary before technical details.
- `P2`: Concise, plain-English wording.

## Title Rules

- Format: `<type>(optional-scope)?: short summary`
- Allowed types/scopes: `.github/workflows/pr-gates.yml`
- Summary starts lowercase, imperative, and ≤ 72 chars.
- Provide 3 title options only when explicitly asked.

## Description Rules

- Start with a short non-technical summary of user impact.
- Add `Internal value:` with 1–2 bullets.
- Insert `---`, then technical section in this order:
  1. `Expected outcome:` (2–4 bullets prefixed by `User impact:` or `Internal impact:`)
  2. `Summary:`
  3. `Changes:`
  4. `Why:`
  5. `Testing:`
  6. `Related:`
  7. `Breaking changes:`

## Style

- Keep language concise and concrete.
- Avoid unnecessary implementation noise.
