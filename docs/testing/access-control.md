# Access Control Testing

Access control functions determine who can read, write, or delete data in our medical platform. These functions are critical for security and must be thoroughly tested.

## When to Use These Patterns

- **Testing access functions** in `src/access/` directory
- **Testing collection access rules** that use user roles
- **Verifying scope filters** for clinic isolation  
- **Error handling** for invalid/missing users

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

Use `test.each` for testing multiple user types against the same function:

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

For functions that return database query filters (not just true/false):

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

Always test what happens when things go wrong:

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

## Collection Rule Examples (Current)

### Posts & Pages (Platform-only mutations)
```typescript
expect(Posts.access!.create!({ req: createMockReq(mockUsers.platform()) } as any)).toBe(true)
expect(Posts.access!.create!({ req: createMockReq(mockUsers.clinic()) } as any)).toBe(false)
expect(Pages.access!.update!({ req: createMockReq(mockUsers.patient()) } as any)).toBe(false)
```

### Media (Platform-only write)
```typescript
expect(Media.access!.create!({ req: createMockReq(mockUsers.platform()) } as any)).toBe(true)
expect(Media.access!.create!({ req: createMockReq(mockUsers.clinic()) } as any)).toBe(false)
```

### FavoriteClinics (patient-own scope)
```typescript
// Read/update/delete use platformOrOwnPatientResource
const req = createMockReq(mockUsers.patient(3))
expect(await platformOrOwnPatientResource({ req })).toEqual({ patient: { equals: 3 } })
```

## Integration with Other Tests

- **Use with collection tests**: Import these helpers in `tests/unit/collections/` 
- **Start with testing-strategy.md**: Overview of all testing patterns
- **Coverage standards**: See `coverage-standards.md` for targets (85%+ on access functions)
- **Test setup**: See `testing-setup.md` for environment configuration
