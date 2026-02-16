# Codex Instruction Router

## Canonical Source

- Canonical global rules: `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/copilot-instructions.md`
- No duplication in `AGENTS.md`; only routing and Codex execution constraints.

## Scoped Instruction Map

- Frontend and UI: `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/instructions/frontend.instructions.md`
- CMS/UI boundary: `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/instructions/cms-ui-boundary.instructions.md`
- Payload, API, hooks, and seeds: `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/instructions/payload.instructions.md`
- Tests: `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/instructions/tests.instructions.md`
- PR metadata only: `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/instructions/pull-requests.instructions.md`

## Execution Requirements (Repository-specific)

- Always read `.github` instructions first.
- After each implementation change run: `pnpm check`, `pnpm build`, `pnpm format`.
- If `check` or `build` fails: fix issues, then rerun `pnpm format`.
- `pnpm build` requires `PAYLOAD_SECRET` and execution outside the sandbox with network access to the Postgres Docker database.

## Payload Migration Workflow

- Create schema migrations only with `pnpm payload migrate:create <migration_name>`.
- Never create migration files manually from scratch.
- If Payload commands can prompt for confirmation, run non-interactive commands to auto-confirm and avoid blocking:
  - `bash -lc "printf 'y\n' | PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate"`
  - `bash -lc "printf 'y\n' | PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate:fresh"`
- For status checks, use:
  - `bash -lc "PAYLOAD_SECRET=${PAYLOAD_SECRET:-dev-secret} pnpm payload migrate:status"`
- Manual edits to generated migration files are allowed only after `migrate:create` generated them.
- Any manual migration adjustment must be documented:
  - Add a short inline comment in the migration file describing what was changed and why.
  - Add the same rationale to commit/PR notes (or linked issue comment) for traceability.

## Language Policy

- Chat and explanations in German unless the user asks otherwise.
- Code, code comments, and documentation in English.

## Conflict Policy

- Avoid conflicting rules across files.
- Keep global rules in `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/copilot-instructions.md`.
- Keep scoped specifics only in `/Users/razorspoint/.codex/worktrees/6c7e/website/.github/instructions/*.instructions.md`.
