# Testing Setup

## Test Structure

```
tests/
├── integration/          # Integration tests
├── unit/                 # Unit tests  
└── setup/globalSetup.ts  # Global setup/teardown
```

## Environment Configuration

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker (for test database isolation)

### Environment Variables
Create `.env.test` file with:
```bash
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc_test
PAYLOAD_SECRET=test-secret-key-for-jwt
SUPABASE_URL=your-test-supabase-url
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_JWT_SECRET=your-test-jwt-secret
```

## Run Test Commands

Run the following commands to execute tests:

```bash
# Run all tests
pnpm tests

# Specific test types
pnpm tests --project integration
pnpm tests --project tests/unit

# With coverage and UI
pnpm tests --coverage
pnpm tests --ui

# Watch mode for development
pnpm tests --watch

# Debug mode
pnpm tests --inspect-brk
```

## Key Rules

1. **Always use `overrideAccess: true`** in tests
2. **Clean up in reverse dependency order** 
3. **Use Docker for test database isolation**
4. **Include `req` parameter for transaction context**


## Global Setup Process

Integration tests automatically handle database lifecycle through [`tests/setup/integrationGlobalSetup.ts`](../../tests/setup/integrationGlobalSetup.ts).

**What happens automatically:**
1. Docker container starts with PostgreSQL test database
2. PayloadCMS migrations run to create schema
3. Tests execute with isolated database
4. Container stops and cleans up after tests

**Files involved:**
- [`docker-compose.test.yml`](../../docker-compose.test.yml) - Database container definition
- [`tests/setup/integrationGlobalSetup.ts`](../../tests/setup/integrationGlobalSetup.ts) - Setup/teardown logic

**No manual Docker commands needed** - the integration test framework handles everything.

## Vitest Configuration

Test configuration is handled in `vitest.config.ts`:
- **Environment**: jsdom for DOM testing
- **Path Aliases**: Matches your `tsconfig.json` paths
- **Global Setup**: Automated database lifecycle
- **Coverage**: Istanbul provider with HTML reports

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
