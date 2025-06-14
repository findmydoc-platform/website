# PayloadCMS Hook Implementation

Create PayloadCMS hooks following project patterns.

## Requirements
- Use proper TypeScript types
- Server-side logging with `payload.logger`
- Handle all operation types (create, update, delete)
- Error handling and validation
- Integration with existing data model

## Hook Types
- `beforeChange`: Data validation, transformation
- `afterChange`: External integrations, cache invalidation
- `beforeValidate`: Input sanitization
- `beforeDelete`: Cleanup operations

## Template
```typescript
import type { CollectionBeforeChangeHook } from 'payload'

export const hookName: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  const { payload, user } = req

  try {
    if (operation === 'create') {
      // Handle creation logic
    }

    if (operation === 'update') {
      // Handle update logic
    }

    return data
  } catch (error) {
    payload.logger.error('Hook error:', { error, operation })
    throw error
  }
}
```

## Common Patterns
- Populate created/updated by fields
- Generate slugs and SEO data
- Sync with external services
- Update relationship counts
- Trigger revalidation

Ask for hook purpose and target collection if not specified.
