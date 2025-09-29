# Testing Patterns & Utilities

This page maps the reusable helpers and conventions so you can jump from doc to code quickly.

## Core Helpers

- **`tests/unit/helpers/mockUsers.ts`** — factories for platform, clinic, patient, and anonymous users. Use them whenever you need a realistic `req.user` object.
- **`tests/unit/helpers/testHelpers.ts`** — `createMockReq`, Payload payload mocks, and assertion helpers used by most unit suites.
- **`tests/unit/access-matrix/matrix-helpers.ts`** — bridge between the permission matrix JSON and the collection tests. Provides `buildUserMatrix`, `buildOperationArgs`, and `validateAccessResult`.

Minimal example using these helpers:

```typescript
const req = createMockReq(mockUsers.platform())
const result = await collection.access.read({ req })
await validateAccessResult({
  collectionSlug: 'clinics',
  operation: 'read',
  expectation: getMatrixRow('clinics').operations.read,
  userType: 'platform',
  user: req.user,
  result,
  req,
})
```

## Fixture Approach (Integration)

Fixtures live in `tests/fixtures` and reuse the real seeding arrays. Typical flow:

1. `ensureBaseline` runs the baseline seeds once per process.
2. `testSlug(__filename)` generates a deterministic prefix for cleanup.
3. `createClinicFixture` or similar helpers create only the records you need.
4. `cleanupTestEntities` removes documents with the test prefix in `afterAll`.

This keeps integration tests predictable without loading full demo data.

## Cleanup Expectations

- Delete dependent documents before their parents (e.g. favorites → clinics → treatments).
- Always pass `overrideAccess: true` when creating or deleting inside tests.
- Use the shared cleanup helpers instead of ad-hoc `payload.delete` loops whenever possible.

## Naming & Structure

- Place suites under the matching domain folder in `tests/` (`access`, `collections`, `hooks`, etc.).
- Name files after the behaviour (`clinics.permission.test.ts`, `patientProvisioning.hook.test.ts`) so watch mode output is readable.
- Keep describe blocks scoped to one behaviour per suite (e.g. `describe('Clinic access')`, `describe('Clinic hooks')`).

## Related Reading

- [Access Control](./access-control.md) — permission matrix workflow and scenario metadata
- [Testing Strategy](./strategy.md) — priorities, coverage, and when to add tests
- [Setup](./setup.md) — environment, commands, and tooling