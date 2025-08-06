# Testing Strategy

## Test Structure
```
tests/unit/
├── access/          # Access control functions
├── collections/     # Collection access patterns  
├── helpers/         # Reusable utilities
└── auth/           # Authentication logic
```

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

*For detailed access control testing patterns, see [access-control-testing.md](./access-control-testing.md)*

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
