# Testing Patterns & Utilities

Common patterns, mock utilities, and testing helpers used across the findmydoc-portal test suite.

## Mock Utilities

### User Mocks

Located in [`tests/unit/helpers/mockUsers.ts`](../../tests/unit/helpers/mockUsers.ts):

```typescript
import { mockUsers } from '../helpers/mockUsers'

// Available user types
mockUsers.platform()     // Platform staff user
mockUsers.clinic()       // Clinic staff user with clinic: 123
mockUsers.patient()      // Patient user
mockUsers.anonymous()    // Returns null (no user)
```

### Request Mocks

Located in [`tests/unit/helpers/testHelpers.ts`](../../tests/unit/helpers/testHelpers.ts):

```typescript
import { createMockReq } from '../helpers/testHelpers'

// Create PayloadRequest with user context
const req = createMockReq(mockUsers.platform())

// Use in access control tests
expect(accessFunction({ req })).toBe(true)
```

## Collection Testing Patterns

### Basic Access Testing

```typescript
describe('Collection Access Control', () => {
  const userMatrix = [
    ['platform staff', mockUsers.platform(), true],
    ['clinic staff', mockUsers.clinic(), false],
    ['patient', mockUsers.patient(), false],
    ['anonymous', null, false],
  ]

  test.each(userMatrix)('%s should have read access: %s', 
    (description, user, expected) => {
      const req = createMockReq(user)
      expect(Collection.access.read({ req })).toBe(expected)
    }
  )
})
```

### Scoped Access Testing

For collections that return query filters instead of boolean:

```typescript
test('clinic staff gets scoped access', async () => {
  const user = mockUsers.clinic()
  const req = createMockReq(user)
  const result = await Collection.access.read({ req })
  
  expect(result).toEqual({
    clinic: { equals: user.clinic }
  })
})
```

## Hook Testing Patterns

### beforeChange Hook Testing

```typescript
describe('Collection beforeChange Hook', () => {
  test('validates required fields', async () => {
    const invalidData = { name: '' }
    const req = createMockReq(mockUsers.platform())
    
    await expect(
      beforeChangeHook({ 
        data: invalidData, 
        req,
        operation: 'create'
      })
    ).rejects.toThrow('Name is required')
  })

  test('transforms data correctly', async () => {
    const inputData = { name: 'test clinic' }
    const req = createMockReq(mockUsers.platform())
    
    const result = await beforeChangeHook({
      data: inputData,
      req,
      operation: 'create'
    })
    
    expect(result.name).toBe('Test Clinic') // Capitalized
    expect(result.slug).toBe('test-clinic') // Auto-generated
  })
})
```

### afterChange Hook Testing

```typescript
describe('Collection afterChange Hook', () => {
  test('sends notification on create', async () => {
    const mockSendEmail = vi.fn()
    const doc = { id: '123', name: 'Test Clinic' }
    
    await afterChangeHook({
      doc,
      req: createMockReq(mockUsers.platform()),
      operation: 'create',
      context: { sendEmail: mockSendEmail }
    })
    
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@findmydoc.com',
        subject: 'New Clinic Created: Test Clinic'
      })
    )
  })
})
```

## Database Testing Patterns

### Test Data Creation

Always use `overrideAccess: true` when creating test data:

```typescript
beforeEach(async () => {
  // Create test data
  testClinic = await payload.create({
    collection: 'clinics',
    data: { name: 'Test Clinic' },
    overrideAccess: true, // Essential for tests
  })
})
```

### Cleanup Pattern

Clean up in reverse dependency order:

```typescript
afterEach(async () => {
  // Delete in reverse dependency order
  const collections = ['reviews', 'clinicTreatments', 'clinics', 'treatments']
  
  for (const collection of collections) {
    await payload.delete({
      collection,
      where: {},
      overrideAccess: true,
    })
  }
})
```

## Error Handling Patterns

### Boundary Testing

Test edge cases and invalid inputs:

```typescript
describe('Access Function Boundary Tests', () => {
  test.each([
    ['null user', null],
    ['undefined user', undefined],
    ['empty object', {}],
    ['missing req', undefined],
  ])('handles %s gracefully', (description, user) => {
    const req = user ? createMockReq(user) : undefined
    
    expect(() => accessFunction({ req })).not.toThrow()
    expect(accessFunction({ req })).toBe(false)
  })
})
```

### Authentication Error Testing

```typescript
test('handles invalid JWT token', () => {
  const invalidReq = {
    headers: { authorization: 'Bearer invalid-token' }
  }
  
  expect(() => authenticateFunction(invalidReq))
    .toThrow('Invalid authentication token')
})
```

## Integration Testing Patterns

### API Endpoint Testing

```typescript
describe('Clinic API Integration', () => {
  test('GET /api/clinics returns clinic data', async () => {
    // Seed test data
    await payload.create({
      collection: 'clinics',
      data: { name: 'Test Clinic', city: 'Berlin' },
      overrideAccess: true
    })
    
    // Test API endpoint
    const response = await fetch('/api/clinics')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.docs).toHaveLength(1)
    expect(data.docs[0].name).toBe('Test Clinic')
  })
})
```

## Test Organization

### File Structure Examples

Based on our [`tests`](../../tests) directory structure:

- **Unit Tests**: [`tests/unit/access/authenticated.test.ts`](../../tests/unit/access/authenticated.test.ts)
- **Collection Tests**: [`tests/unit/collections/Clinics.test.ts`](../../tests/unit/collections/Clinics.test.ts)
- **Integration Tests**: [`tests/integration/clinic.test.ts`](../../tests/integration/clinic.test.ts)
- **Shared Utilities**: [`tests/unit/helpers/`](../../tests/unit/helpers/)

### Test Suite Organization

```typescript
describe('ClinicCollection', () => {
  describe('access control', () => {
    // Access control tests
  })
  
  describe('validation hooks', () => {
    // Hook tests
  })
  
  describe('field configurations', () => {
    // Field-specific tests
  })
})
```