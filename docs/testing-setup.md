# Testing Setup Documentation

## Overview

This document describes the robust integration and unit testing setup for the FindMyDoc medical platform built with PayloadCMS v3, Next.js, PostgreSQL, and Supabase authentication.

## Test Structure

### Directory Layout
```
tests/
├── integration/          # Integration tests
│   └── clinic.test.ts
├── unit/                 # Unit tests
│   └── sample.test.ts
└── setup/
    └── globalSetup.ts    # Global test setup and teardown
```

### Test Configuration

The test setup uses:
- **Vitest** as the test runner
- **Docker Compose** for isolated test database
- **Global setup/teardown** for clean test environment
- **Access override** for test data operations

## Database Setup

### Test Database Isolation

Tests run against a separate PostgreSQL database using Docker Compose: **docker-compose.test.yml**

### Environment Variables

Test environment uses:
```
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc_test
```

### Global Setup Process

1. **Start**: Docker Compose brings up test database
2. **Migrate**: Run `pnpm payload migrate` to ensure schema is current
3. **Tests**: Execute test suite with clean database state
4. **Teardown**: Docker Compose down with volume cleanup

## Test Data Management

### Access Control Override

All test operations use `overrideAccess: true` to bypass collection access control:

```typescript
// Creating test data
const testData = await payload.create({
  collection: 'collections-name',
  data: { /* test data */ },
  overrideAccess: true,
})

// Querying test data
const result = await payload.findByID({
  collection: 'collection-name',
  id: testId,
  overrideAccess: true,
})
```

### Data Cleanup

Each test uses `beforeEach` cleanup with proper dependency order:

```typescript
beforeEach(async () => {
  // Clean up in reverse dependency order
  const collectionsToClean = [
    'clinictreatments',  // Child relationships first
    'clinics',
    'treatments',
    'medical-specialties',
    'cities',
    'countries',          // Parent relationships last
  ]

  for (const collection of collectionsToClean) {
    try {
      await payload.delete({
        collection,
        where: {},
        overrideAccess: true,
      })
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})
```

## Best Practices

### 1. Access Control Override
Always use `overrideAccess: true` for test operations to avoid authentication/authorization issues.

### 2. Dependency Order
Clean up test data in reverse dependency order to avoid foreign key constraint violations.

### 3. Error Handling
Wrap cleanup operations in try-catch blocks to prevent test failures from cleanup issues.

## Running Tests

### Commands

```bash
# Run all tests
pnpm test

# Run integration tests only
pnpm test tests/integration

# Run unit tests only
pnpm test tests/unit

# Run specific test file
pnpm test tests/integration/clinic.test.ts
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**: Check if test database port 5433 is available
2. **Migration Errors**: Ensure source database schema is up to date
3. **Relationship Errors**: Verify join field configurations in collections
4. **Access Control**: Ensure all test operations use `overrideAccess: true`
