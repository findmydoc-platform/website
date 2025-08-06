# Testing Guide

Complete testing documentation for the findmydoc-portal medical platform.

## Quick Start

```bash
# Run all tests
pnpm tests

# Specific test types
pnpm tests --project integration
pnpm tests --project tests/unit

# With coverage and UI
pnpm tests --coverage
pnpm tests --ui
```

## Documentation Structure

- [**Setup & Environment**](./setup.md) - Database setup, Docker, environment variables
- [**Testing Strategy**](./strategy.md) - Test organization, patterns, what to test
- [**Access Control Testing**](./access-control.md) - Permission testing patterns
- [**Common Patterns**](./patterns.md) - Mock utilities, collection tests, hooks

## Test Organization

Our tests live in the [`tests`](../../tests) directory with clear separation:

```
tests/
├── unit/
│   ├── access/           # Access control functions
│   ├── collections/      # Collection configurations
│   ├── auth/            # Authentication logic
│   ├── helpers/         # Test utilities (mockUsers, testHelpers)
│   └── hooks/           # Business logic hooks
├── integration/         # Cross-system tests
└── setup/              # Global setup/teardown
```

## Coverage Requirements

- **Access Control**: 100% (critical security functions)
- **Hooks**: 80% (business logic)
- **Collections**: 70% (configuration testing)
- **Overall**: 70% minimum

## Key Testing Rules

1. Always use `overrideAccess: true` in test data operations
2. Clean up collections in reverse dependency order
3. Use Docker for test database isolation
4. Reference existing test files as implementation examples