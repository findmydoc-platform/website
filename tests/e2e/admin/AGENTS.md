# Admin E2E Rules

## Priorities

- `P0`: Admin specs prove real operator flows with minimal duplicated form logic.
- `P1`: Smoke stays narrow; longer collection chains live in regression.
- `P2`: Specs are thin consumers of shared setup, journeys, and helper assertions.

## Critical Rules

- If a shared admin journey already exists for the behavior under test, use `executeAdminJourney(...)` instead of re-implementing the same selectors in the spec.
- Keep smoke specs focused on login, reachability, and one small success path per area.
- Put longer dependency chains, clinic-staff paths, and multi-collection orchestration in dedicated regression specs.
- When introducing a new admin collection flow with guide or reuse value, add it to the shared journey registry before adding ad-hoc capture logic.
