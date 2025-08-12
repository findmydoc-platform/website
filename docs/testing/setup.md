# Testing Setup

## Test Structure

```
tests/
├── integration/          # Integration tests
├── unit/                 # Unit tests  
└── setup/globalSetup.ts  # Global setup/teardown
```

## Environment

### Prerequisites
* Node.js 18+
* pnpm 8+
* Docker (DB isolation)

### Environment Variables
Create `.env.test`:
```bash
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc_test
PAYLOAD_SECRET=test-secret-key-for-jwt
SUPABASE_URL=your-test-supabase-url
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_JWT_SECRET=your-test-jwt-secret
```

## Commands

```bash
# Run all tests
pnpm test

# Specific test types
pnpm test --project integration
pnpm test --project tests/unit

# With coverage and UI
pnpm test --coverage
pnpm test --ui

# Watch mode for development
pnpm test --watch

# Debug mode
pnpm test --inspect-brk
```

## Key Rules
1. Always set `overrideAccess: true`
2. Clean up reverse dependency order
3. Docker provides isolation
4. Pass `req` when code expects request context


## Global Setup
`integrationGlobalSetup.ts` automates DB lifecycle:
1. Start Postgres container
2. Run migrations
3. Run tests
4. Stop & clean container

Files:
* `docker-compose.test.yml`
* `tests/setup/integrationGlobalSetup.ts`

You do not run Docker manually.

## Vitest Config
Defined in `vitest.config.ts` (jsdom env, path aliases, global setup, coverage).

## Data Creation Example

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
