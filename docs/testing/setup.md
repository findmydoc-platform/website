# Testing Setup

## Test Structure

```
tests/
├── integration/          # Integration tests
├── unit/                 # Unit tests  
└── setup/globalSetup.ts  # Global setup/teardown
```

## Run Test Commands

Run the following commands to execute tests:

```bash
# Run all tests
pnpm tests

# Specific test types
pnpm tests --project integration
pnpm tests --project tests/unit

# With coverage
pnpm tests --coverage
```

## Key Rules

1. **Always use `overrideAccess: true`** in tests
2. **Clean up in reverse dependency order** 
3. **Use Docker for test database isolation**
4. **Include `req` parameter for transaction context**

## Database Setup

This is setup during integration tests.

```bash
# Test database (Docker)
docker-compose -f docker-compose.test.yml up -d

# Environment
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc_test
```

## Global Setup Process

This can be more observed in the following file (./tests/setup/globalSetup.ts)[./tests/setup/globalSetup.ts]

```typescript
// tests/setup/globalSetup.ts
export default async function setup() {
  // Start test database
  await exec('docker-compose -f docker-compose.test.yml up -d')
  
  // Run migrations
  await exec('pnpm payload migrate')
}

export async function teardown() {
  await exec('docker-compose -f docker-compose.test.yml down -v')
}
```

## Test Patterns for Data Creation

```typescript
// Test data with access override
const testData = await payload.create({
  collection: 'clinics',
  data: { name: 'Test Clinic' },
  overrideAccess: true, // Essential for tests
})

// Cleanup (reverse dependency order)
beforeEach(async () => {
  const collections = ['clinictreatments', 'clinics', 'treatments']
  for (const collection of collections) {
    await payload.delete({
      collection,
      where: {},
      overrideAccess: true,
    })
  }
})
```
