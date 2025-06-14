# PayloadCMS Collection Creator

Create a new PayloadCMS collection for the medical platform.

## Requirements
- Use TypeScript with proper imports: `import type { CollectionConfig } from 'payload'`
- Import access functions from `@/access/` directory
- Group under 'Medical Network' in admin
- Include proper field descriptions
- Mark required fields appropriately
- Add indexes for relationship fields

## Template Structure
```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const Collection: CollectionConfig = {
  slug: 'collectionName',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    description: 'Collection description',
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    // Add fields here
  ],
  timestamps: true,
}
```

## Common Field Patterns
- Name/title fields with validation
- Relationships to other collections with appropriate access
- Status fields for workflow management
- Rich text for descriptions
- Upload fields for media

Ask for collection name, purpose, and required fields if not provided.
