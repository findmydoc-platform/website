# Testing Strategy

## Test Organization

We separate tests by purpose:

```
tests/
├── unit/
│   ├── access/          # Access control functions
│   ├── collections/     # Collection access patterns
│   ├── helpers/         # Reusable utilities
│   ├── auth/           # Authentication logic
│   └── hooks/          # Business logic hooks
├── integration/        # Cross-system tests
└── setup/             # Global setup/teardown
```

Reason: Complex domain needs shared helpers and isolated DB.

## What We Test / Skip

### MUST Test
* Access control (100%)
* Authentication
* Hook business logic
* Collection access patterns

### SHOULD Test
* Field validation
* Error handling
* Edge/boundary cases

### DO NOT Test
* Payload internals
* Supabase SDK
* Generated types
* Migration files

## Core Patterns

### Access Control Test
```typescript
// Standard pattern for access functions
test.each([
  ['platform staff', mockUsers.platform(), true],
  ['clinic staff', mockUsers.clinic(), false],
  ['patient', mockUsers.patient(), false],
])('%s access: %s', (desc, user, expected) => {
  const req = createMockReq(user)
  expect(accessFunction({ req })).toBe(expected)
})
```

See [access-control.md](./access-control.md) and examples in [`tests/unit/access/`](../../tests/unit/access/).

### Collection Test
```typescript
// Collection access pattern testing
describe('Collection Access', () => {
  test('platform staff gets full access', () => {
    expect(Collection.access.read({ req: platformReq })).toBe(true)
  })

  test('clinic staff gets scoped access', async () => {
    const result = await Collection.access.read({ req: clinicReq })
    expect(result).toEqual({ clinic: { equals: 123 } })
  })
})
```

Examples: [`tests/unit/collections/`](../../tests/unit/collections/).

### Error Handling
```typescript
// Invalid input scenarios
test.each([
  ['null user', null],
  ['undefined user', undefined],
  ['empty object', {}],
])('handles %s gracefully', (desc, user) => {
  const req = createMockReq(user)
  expect(() => accessFunction({ req })).not.toThrow()
})
```

Example: [`tests/unit/access/boundaryTests.test.ts`](../../tests/unit/access/boundaryTests.test.ts).

## File Organization & Naming

### Test File Location
Tests sit in [`tests`](../../tests) (not beside source):

- **Access functions**: [`tests/unit/access/`](../../tests/unit/access/)
- **Collections**: [`tests/unit/collections/`](../../tests/unit/collections/)
- **Authentication**: [`tests/unit/auth/`](../../tests/unit/auth/)
- **Hooks**: [`tests/unit/hooks/`](../../tests/unit/hooks/)

### Test Utilities
Shared utilities: [`tests/unit/helpers/`](../../tests/unit/helpers/)

- **mockUsers.ts**: User mock factories
- **testHelpers.ts**: Common test utilities

### Naming
* Standard: `[feature].test.ts`
* Edge cases: `[feature].edge-cases.test.ts`
* Boundary: `boundaryTests.test.ts`

## Mock Utilities Reference

Available in [`tests/unit/helpers/`](../../tests/unit/helpers/):

```typescript
// From tests/unit/helpers/mockUsers.ts
mockUsers.platform()    // Platform staff user
mockUsers.clinic()      // Clinic staff user
mockUsers.patient()     // Patient user

// From tests/unit/helpers/testHelpers.ts
createMockReq(user)     // Creates PayloadRequest with user
```

Full details: [patterns.md](./patterns.md)
