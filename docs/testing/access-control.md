# Access Control Testing

Access control decides who can read, write, or delete. Because every collection surfaces sensitive medical data, we treat these tests as critical.

## When To Add Or Update Tests

- You touch anything in `src/access/`.
- A collection `access` rule changes.
- A hook or resolver starts returning a new scope filter.
- You fix an access bug and need a regression test.

## Key Helpers (all live in `tests/unit`)

- `helpers/mockUsers.ts` — quick factories for platform, clinic, patient, and anonymous requests.
- `helpers/testHelpers.ts` — `createMockReq`, mock payload instances, and general utilities.
- `access-matrix/matrix-helpers.ts` — wraps the permission matrix JSON so collection tests can assert the right truthy/falsey/scope values via `validateAccessResult`.

Lean on existing suites (for example `tests/unit/access-matrix/clinics.permission.test.ts`) whenever you are unsure which pattern to follow.

## Permission Matrix Collection Tests

New collections and access changes must stay aligned with the permission matrix. Use this checklist when authoring a collection test without automation:

1. Update `docs/security/permission-matrix.config.ts` with the new `MatrixRow`, fill the `operations`, and choose a `meta.conditional` scenario kind that matches the access helper you expect (see inline comments in that file for scenario definitions).
2. Run the matrix tooling so documentation and JSON snapshots stay current:
   - `pnpm matrix:derive` regenerates the docs and machine snapshot.
   - `pnpm matrix:derive json` refreshes `tmp/permission-matrix.json` for local tests if needed.
3. Create or update `tests/unit/access-matrix/<slug>.permission.test.ts`:
   - Import the collection, `getMatrixRow`, `buildUserMatrix`, `buildOperationArgs`, and `validateAccessResult` from `tests/unit/access-matrix/matrix-helpers`.
   - Use `test.each(buildUserMatrix())` to cover platform, clinic, patient, and anonymous users per operation.
   - Pass `args` from `buildOperationArgs` into `validateAccessResult` so scenario-specific assertions (clinic scope, patient self-update, media ownership) work.
4. If your collection needs a brand new scenario, extend `ConditionalScenarioKind` plus the translator in `matrix-helpers.ts`, add a short comment describing its intent, and keep the matrix notes in sync.
5. Finish by running `pnpm matrix:verify` and `pnpm tests --project=unit` to confirm coverage and behaviour.

Following this routine keeps the config, generated docs, and tests synchronized for future contributors.

## Additional Tips

- Basic access helpers (`src/access`) should cover platform, clinic, patient, and anonymous paths using `test.each`. Move any new helper into `tests/unit/access/` with the same format.
- When an access function returns a filter, assert the shape rather than the exact object reference. `validateAccessResult` already checks `equals` values for the common cases.
- Error handling matters: verify that invalid requests fail safely (return `false` or a scoped filter) instead of throwing unhandled errors.

## Related

- Tests live alongside other suites in `tests/unit/collections/` and `tests/unit/access/`.
- Strategy overview: [testing/strategy.md](./strategy.md)
- Environment details: [testing/setup.md](./setup.md)
