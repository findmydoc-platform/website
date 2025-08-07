# Testing Strategy

## Test Organization

Our test structure follows a clear separation of concerns:

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

**Why separate directory?** Complex medical platform with shared test utilities, database setup, and integration tests that span multiple collections.

## What We Test vs What We Don't

### ✅ MUST Test
- **Access control functions** (100% coverage required)
- **Authentication flows** (critical security)
- **Business logic in hooks** (data validation, transformations)
- **Collection configurations** (access patterns)

### ⚠️ SHOULD Test  
- **Field validations**
- **Error handling**
- **Edge cases and boundary conditions**

### ❌ DON'T Test
- **PayloadCMS internals** (framework code)
- **Supabase SDK methods** (third-party)
- **Generated types** (`payload-types.ts`)
- **Migration files** (schema changes)

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

*For detailed access control testing patterns, see [access-control.md](./access-control.md)*

*Implementation examples: [`tests/unit/access/`](../../tests/unit/access/)*

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

*Implementation examples: [`tests/unit/collections/`](../../tests/unit/collections/)*

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

*Implementation examples: [`tests/unit/access/boundaryTests.test.ts`](../../tests/unit/access/boundaryTests.test.ts)*

## File Organization & Naming

### Test File Location
Tests are organized in the [`tests`](../../tests) directory, not co-located with source files:

- **Access functions**: [`tests/unit/access/`](../../tests/unit/access/)
- **Collections**: [`tests/unit/collections/`](../../tests/unit/collections/)
- **Authentication**: [`tests/unit/auth/`](../../tests/unit/auth/)
- **Hooks**: [`tests/unit/hooks/`](../../tests/unit/hooks/)

### Test Utilities
Shared testing utilities are centralized in [`tests/unit/helpers/`](../../tests/unit/helpers/):

- **mockUsers.ts**: User mock factories
- **testHelpers.ts**: Common test utilities

### Naming Conventions
- Test files: `[functionality].test.ts`
- Edge cases: `[functionality].edge-cases.test.ts`
- Boundary tests: `boundaryTests.test.ts`

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

*For complete mock utilities documentation, see [patterns.md](./patterns.md)*
```
