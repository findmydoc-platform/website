# Testing Guide

This guide explains how to run and structure tests.

## Quick Start

```bash
# Run all tests
pnpm test

# Specific test types
pnpm test --project integration
pnpm test --project tests/unit

# With coverage and UI
pnpm test --coverage
pnpm test --ui
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

## Integration Test Coverage

The integration test suite provides comprehensive coverage of core collections and access rules:

### Core Collections Tested
- **Medical Specialties**: Hierarchical relationships, platform-only mutations, uniqueness
- **Doctors**: fullName hook automation, clinic-scoped access, qualification validation
- **Clinics**: Status field restrictions, geographic relationships, rating aggregation
- **Reviews**: Rating calculation hooks, multi-entity updates, approval workflows
- **Treatments**: Medical specialty requirements, rich text descriptions, price tracking
- **Countries/Cities**: Geographic integrity, relationship dependencies
- **Accreditation**: Quality standards, country-specific certifications

### Join Collections Tested
- **Clinic-Treatments**: Price averaging hooks, access scoping, unique constraints
- **Doctor-Specialties**: Many-to-many relationships, specialization levels, certifications

### Test Coverage Areas
1. **Access Control Matrix**: Platform/clinic/patient/anonymous user permissions
2. **Relationship Integrity**: Valid references, invalid ID rejection, population
3. **Derived Field Computation**: Automatic field generation (e.g., doctor fullName)
4. **Rating Aggregation**: Multi-entity rating updates from review changes
5. **Field Validation**: Required fields, data types, complex structures
6. **Soft Delete Behavior**: Trash-enabled collections and data integrity
7. **Business Logic Hooks**: Real-world scenarios for calculation and validation hooks

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