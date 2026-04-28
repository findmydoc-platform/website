# E2E Helper Rules

## Priorities

- `P0`: Shared helper changes stay deterministic across all admin journey consumers.
- `P1`: Journey logic, fixture setup, and session plumbing live in reusable helpers instead of duplicated spec code.
- `P2`: Validation is explicit about which smoke, regression, or capture consumer was exercised.

## Critical Rules

- Prefer extending the shared admin journey registry and step helpers over adding new inline admin selectors to spec files.
- Keep fixture provisioning in helper or setup layers when the dependency is not itself the UI behavior under test.
- When changing `adminJourneys/**`, update the nearest consumer spec or unit test so the helper change is exercised by a real journey.
- When changing shared admin helper plumbing, run the matching targeted unit tests first, then the smallest required Playwright lane from `tests/e2e/AGENTS.md`.
- Shared helper edits must not silently expand the default smoke lane; keep longer dependent flows in regression unless the user explicitly asks to promote them.
