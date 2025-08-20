# Access Control Testing

Access control decides who can read, write, or delete. It is security critical.

## When to Use
* Functions in `src/access/`
* Collection access rules
* Scope filters (clinic isolation)
* Error handling for invalid / missing users

## Test Helpers
```typescript
// tests/unit/helpers/testHelpers.ts
export const createMockReq = (user?: any, payload = createMockPayload()) => ({
  user, payload, context: {}
})

export const createMockPayload = () => ({
  find: vi.fn(),
  create: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() }
})
```

```typescript
// tests/unit/helpers/mockUsers.ts
export const mockUsers = {
  platform: (id = 1) => ({ id, collection: 'basicUsers', userType: 'platform' }),
  clinic: (id = 2, clinicId = 1) => ({ id, collection: 'basicUsers', userType: 'clinic', clinicId }),
  patient: (id = 3) => ({ id, collection: 'patients' }),
  anonymous: () => null
}
```

## Basic Access Function Tests
Use `test.each` to cover multiple user types:

```typescript
// Basic access function pattern
describe('isPlatformBasicUser', () => {
  test.each([
    ['platform user', mockUsers.platform(), true],
    ['clinic user', mockUsers.clinic(), false],
    ['patient', mockUsers.patient(), false],
    ['null user', null, false]
  ])('%s returns %s', (desc, user, expected) => {
    const req = createMockReq(user)
    expect(isPlatformBasicUser({ req })).toBe(expected)
  })
})
```

## Scope Filter Tests
For functions that return filter objects:

```typescript
// Scope filter testing with async
describe('platformOrOwnClinicResource', () => {
  test('platform staff gets full access', async () => {
    const req = createMockReq(mockUsers.platform())
    expect(await platformOrOwnClinicResource({ req })).toBe(true)
  })

  test('clinic staff gets scoped access', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValue({ docs: [{ clinic: 123 }] })
    
    const req = createMockReq(mockUsers.clinic(), mockPayload)
    const result = await platformOrOwnClinicResource({ req })
    expect(result).toEqual({ clinic: { equals: 123 } })
  })
})
```

## Error Scenarios
Test failure paths:

```typescript
// Error handling pattern
test('handles database errors gracefully', async () => {
  const mockPayload = createMockPayload()
  mockPayload.find.mockRejectedValue(new Error('DB error'))
  
  const req = createMockReq(mockUsers.clinic(), mockPayload)
  const result = await scopeFunction({ req })
  expect(result).toBe(false) // Should fail safely
})
```

## Collection Rule Examples

### Posts & Pages (platform-only write)
```typescript
expect(Posts.access!.create!({ req: createMockReq(mockUsers.platform()) } as any)).toBe(true)
expect(Posts.access!.create!({ req: createMockReq(mockUsers.clinic()) } as any)).toBe(false)
expect(Pages.access!.update!({ req: createMockReq(mockUsers.patient()) } as any)).toBe(false)
```

### Media (platform-only write)
```typescript
expect(Media.access!.create!({ req: createMockReq(mockUsers.platform()) } as any)).toBe(true)
expect(Media.access!.create!({ req: createMockReq(mockUsers.clinic()) } as any)).toBe(false)
```

### FavoriteClinics (patient scope)
```typescript
// Read/update/delete use platformOrOwnPatientResource
const req = createMockReq(mockUsers.patient(3))
expect(await platformOrOwnPatientResource({ req })).toEqual({ patient: { equals: 3 } })
```

## Related
* Use with collection tests in `tests/unit/collections/`
* Overview: `testing/strategy.md`
* Coverage: `coverage-standards.md`
* Setup: `testing/setup.md`
