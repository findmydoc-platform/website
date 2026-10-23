# Admin E2E Rules

## Critical Rules

- If a shared admin journey already exists for the behavior under test, use `executeAdminJourney(...)` instead of re-implementing the same selectors in the spec.
- Keep smoke specs focused on login, reachability, and one small success path per area.
- Put longer dependency chains and multi-collection orchestration in dedicated regression specs.
- When introducing a new admin collection flow with guide or reuse value, add it to the shared journey registry before adding ad-hoc capture logic.
