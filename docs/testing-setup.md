# Testing Setup Documentation

## Overview

This document describes the robust integration and unit testing setup for the FindMyDoc medical platform built with PayloadCMS v3, Next.js, PostgreSQL, and Supabase authentication.

## Test Structure

### Directory Layout
```
tests/
├── integration/          # Integration tests
│   ├── priceCalculation.test.ts
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

Tests run against a separate PostgreSQL database using Docker Compose:

**docker-compose.test.yml**:
```yaml
services:
  postgres-test:
    image: postgres:16
    environment:
      POSTGRES_DB: findmydoc_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5433:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data

volumes:
  postgres_test_data:
```

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

## Integration Tests

### Price Calculation Test

Tests the core business logic of automatic price calculation when clinic treatments are created:

1. **Setup**: Creates test country, city, medical specialty, treatment, and clinic
2. **First Calculation**: Creates clinic treatment with price 100, verifies treatment.averagePrice = 100
3. **Second Calculation**: Creates second clinic with price 200, verifies treatment.averagePrice = 150

### Key Validation Points

- **Hook Execution**: Validates that `afterChange` hooks run correctly
- **Average Calculation**: Ensures mathematical accuracy of price averaging
- **Relationship Integrity**: Confirms proper handling of related entities

## Best Practices

### 1. Access Control Override
Always use `overrideAccess: true` for test operations to avoid authentication/authorization issues.

### 2. Dependency Order
Clean up test data in reverse dependency order to avoid foreign key constraint violations.

### 3. Error Handling
Wrap cleanup operations in try-catch blocks to prevent test failures from cleanup issues.

### 4. Lexical Content
Use helper functions for consistent Lexical editor content:

```typescript
function lexicalDescription(text: string): any {
  return {
    root: {
      type: 'root',
      children: [{
        type: 'paragraph',
        version: 1,
        children: [{
          type: 'text',
          version: 1,
          text: text,
        }],
      }],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
```

### 5. Timeouts
Set appropriate timeouts for integration tests (e.g., 15 seconds) to accommodate database operations.

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
pnpm test tests/integration/priceCalculation.test.ts

# Type check and lint
pnpm check
```

### CI/CD Considerations

1. **Docker Availability**: Ensure Docker is available in CI environment
2. **Port Conflicts**: Use non-standard ports (5433) to avoid conflicts
3. **Cleanup**: Global teardown ensures complete cleanup after test runs
4. **Migration State**: Always run migrations to ensure schema consistency

## Troubleshooting

### Common Issues

1. **Port Already in Use**: Check if test database port 5433 is available
2. **Migration Errors**: Ensure source database schema is up to date
3. **Relationship Errors**: Verify join field configurations in collections
4. **Access Control**: Ensure all test operations use `overrideAccess: true`

### Debug Commands

```bash
# Check test database status
docker compose -f docker-compose.test.yml ps

# View test database logs
docker compose -f docker-compose.test.yml logs postgres-test

# Manual cleanup
docker compose -f docker-compose.test.yml down -v --remove-orphans

# Run migrations manually
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc_test pnpm payload migrate
```

## Collection Configuration Notes

### Join Fields
Ensure join fields are properly configured in collections:

```typescript
// In Treatments collection
{
  name: 'clinicTreatments',
  type: 'join',
  collection: 'clinictreatments',
  on: 'treatment',  // Points to the foreign key field in clinictreatments
}

// In ClinicTreatments collection
{
  name: 'treatment',
  type: 'relationship',
  relationTo: 'treatments',
  required: true,
  index: true,
}
```

This setup ensures proper business logic where treatments can query their associated clinic treatments through the join field.
