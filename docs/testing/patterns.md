# Testing Patterns & Utilities

This page shows how we write and structure tests. Language is kept simple. Concepts stay the same.

## Mock Utilities

### User Mocks

Located in [`tests/unit/helpers/mockUsers.ts`](../../tests/unit/helpers/mockUsers.ts):

```typescript
import { mockUsers } from '../helpers/mockUsers'

// Available user types (helpers return plain user objects)
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

Always set `overrideAccess: true` when writing data in tests. This skips collection access rules so tests stay focused:

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

Delete in reverse dependency order (child first, parent last):

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

Cover edge cases and invalid inputs:

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

## Seeding-Based Fixture Pattern

We reuse real seed data through small fixtures. This keeps tests:
* Fast (only create what you need)
* Consistent (same shapes as the app)
* Clean (easy targeted cleanup)
* Light (no full demo seeding inside tests)

### Objectives
1. One source of truth for seed shapes
2. Minimal data per test
3. Predictable cleanup via slug prefixes
4. Avoid full demo seeds in tests

### Core Fixtures (in `tests/fixtures/`)
| Fixture | Purpose | Key Notes |
| ------- | ------- | --------- |
| `ensureBaseline.ts` | Runs baseline seeds once per process | Memoized boolean guard; call early in integration suites |
| `createClinicFixture.ts` | Creates a clinic (and optionally a doctor) using seed array entries | Imports seed arrays from seeding code to avoid drift |
| `testSlug.ts` | Deterministic slug prefix builder | `testSlug(__filename)` -> `test-clinic-test` style prefix |
| `cleanupTestEntities.ts` | Cleans entities whose slug starts with test prefix | Uses `like` query and `overrideAccess: true` |

### Usage Pattern (Integration Test)
```typescript
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('Clinic integration (fixture pattern)', () => {
  const slugPrefix = testSlug(__filename)
  let clinic: any

  beforeAll(async () => {
    await ensureBaseline(payload) // baseline reference data (countries, cities, specialties, etc.)
  })

  afterAll(async () => {
    await cleanupTestEntities(payload, { slugPrefix })
  })

  test('creates clinic with doctor from seed arrays', async () => {
    clinic = await createClinicFixture(payload, { slugPrefix })
    expect(clinic.name).toBeTruthy()
    expect(clinic.slug.startsWith(slugPrefix)).toBe(true)
  })
})
```

### Fixture Principles
* Do not run the full demo seeding inside tests
* Import seed arrays; do not copy objects
* Use deterministic slug prefixes for cleanup
* Only create related docs you actually assert on
* Always set `overrideAccess: true`

### Adding Another Fixture
1. Import the seed array for that domain
2. Support `{ seedIndex, overrides }`:
  - `seedIndex` selects which seed item to clone
  - `overrides` (a partial object) lets you change only needed fields (e.g. name, foreign keys)
3. Apply the shared `slugPrefix` (or add a marker field if no slug)
4. Return created docs (and directly related docs) to avoid extra queries

### Cleanup Strategy
`cleanupTestEntities` deletes items whose slug starts with the test prefix. Prefer this targeted delete over wiping whole collections.

### Related Docs
* Seeding usage: `docs/seeding.md`
* More testing patterns: sections above

### Quick Pattern Recap
1. Run baseline seeds once with `ensureBaseline`
2. Build prefix: `const slugPrefix = testSlug(__filename)`
3. Create data via fixture (not manual `payload.create`)
4. Assert only what matters
5. Cleanup via `cleanupTestEntities`

## New Examples

- See `tests/unit/collections/Pages.test.ts` and `Posts.test.ts` for platform-only mutation tests using `platformOnlyOrPublished` mock.
- See `tests/unit/collections/Media.test.ts` for platform-only write assertions.
- See `tests/unit/collections/FavoriteClinics.test.ts` for scope-filter based access using `platformOrOwnPatientResource` mock.

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