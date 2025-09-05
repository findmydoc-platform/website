# Testing Guide

This guide explains how to run and structure tests.

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

## Docs Map

- [Setup & Environment](./setup.md) – DB, Docker, env vars
- [Testing Strategy](./strategy.md) – What we test / structure
- [Access Control](./access-control.md) – Permission patterns
- [Common Patterns](./patterns.md) – Utilities, fixtures, hooks

## Test Organization

All tests live in [`tests`](../../tests):

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

## Coverage Targets

- Access Control: 100% (security critical)
- Hooks: 80%
- Collections: 70%
- Overall: 70% minimum

## Key Rules

1. Always set `overrideAccess: true` when writing data
2. Clean up in reverse dependency order (child → parent)
3. Use Docker DB isolation (handled by setup scripts)
4. Look at existing tests for quick examples