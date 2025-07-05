# Test Setup

## Structure
```
tests/
├── unit/           # Unit tests (fast, isolated)
├── integration/    # Integration tests (with database)
└── README.md       # This file
```

## Commands
- `pnpm test` - Run all tests
- `pnpm test tests/unit` - Run only unit tests
- `pnpm test tests/integration` - Run only integration tests

## Test Environment
- Uses PostgreSQL test database via Docker
- Global setup/teardown in `test/` directory (root level)
- Test timeout: 30 seconds

## Current Tests
- **Unit**: Basic sample tests (fast)
- **Integration**: Clinic creation test with dependencies (Country → City → Clinic)

## Next Steps
From here you can:
1. Add more unit tests in `tests/unit/`
2. Expand the clinic integration test with real assertions
3. Add price calculation tests in `tests/integration/`
4. Test the setup/teardown process thoroughly

The fake integration test currently just creates a clinic with all its dependencies and verifies the creation worked. This validates that:
- Database connection works
- PayloadCMS initialization works
- Collection dependencies are properly handled
- Cleanup works correctly
