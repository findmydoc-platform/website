# PayloadCMS Development Guidelines for GitHub Copilot

## Project Overview
This is a PayloadCMS v3 application for a medical platform (`findmydoc-portal`) with Next.js frontend, PostgreSQL database, and Supabase authentication. The application manages clinics, doctors, patients, treatments, and reviews in a multi-user medical network.

## Core PayloadCMS Patterns

### 1. Collection Configuration Structure
When creating or modifying PayloadCMS collections:

```typescript
import type { CollectionConfig } from 'payload'

export const MyCollection: CollectionConfig = {
  slug: 'myCollection',
  admin: {
    group: 'Group Name',
    useAsTitle: 'titleField',
    defaultColumns: ['field1', 'field2', 'status'],
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    // Field definitions here
  ],
  hooks: {
    beforeChange: [hookFunction],
    afterChange: [hookFunction],
  },
  timestamps: true,
}
```

### 2. Field Type Patterns
Common field patterns used in this project:

- **Text/String fields**: `type: 'text'` with validation
- **Rich text**: `type: 'richText'` with lexical editor
- **Relationships**: `type: 'relationship'` with `relationTo` property
- **Select fields**: `type: 'select'` with `options` array
- **Numbers**: `type: 'number'` with min/max constraints
- **Dates**: `type: 'date'` for timestamps
- **Groups**: `type: 'group'` for nested field organization
- **Arrays**: `type: 'array'` for repeating content
- **Joins**: `type: 'join'` for two-way relationships
- **Uploads**: `type: 'upload'` for file/media fields

### 3. Access Control Patterns
Always import access functions from `@/access/` directory:

```typescript
import { authenticated } from '@/access/authenticated'
import { isStaff, isPlatformStaff, isClinicStaff } from '@/access/isStaff'
import { isPatient } from '@/access/isPatient'

// Use in collection config
access: {
  read: () => true, // Public read
  create: authenticated, // Authenticated users only
  update: isPlatformStaff, // Platform staff only
  delete: isPlatformStaff,
}
```

### 4. Admin Configuration
Standard admin configuration patterns:

```typescript
admin: {
  group: 'Medical Network', // Group collections logically
  useAsTitle: 'name', // Field to use as document title
  defaultColumns: ['name', 'status', 'createdAt'], // List view columns
  description: 'Description text for editors',
  hidden: false, // Show/hide from admin navigation
}
```

### 5. Hook Patterns
Common hook implementations:

```typescript
hooks: {
  beforeChange: [
    ({ data, operation }) => {
      if (operation === 'create') {
        data.createdBy = req.user.id
      }
      return data
    }
  ],
  afterChange: [
    ({ doc, operation }) => {
      // Revalidate pages, update external services, etc.
    }
  ]
}
```

### 6. Relationship Field Patterns
For relationships between collections:

```typescript
{
  name: 'clinic',
  type: 'relationship',
  relationTo: 'clinics',
  required: true,
  hasMany: false, // Single relationship
  admin: {
    description: 'Associated clinic'
  }
}

// For many-to-many relationships:
{
  name: 'tags',
  type: 'relationship',
  relationTo: 'tags',
  hasMany: true,
}

// For join fields (two-way relationships):
{
  name: 'treatments',
  type: 'join',
  collection: 'clinictreatments',
  on: 'clinic',
}
```

### 7. Validation Patterns
Custom validation functions:

```typescript
{
  name: 'email',
  type: 'email',
  required: true,
  validate: (value, { operation }) => {
    if (!value && operation === 'create') {
      return 'Email is required'
    }
    return true
  }
}
```

### 8. Global Configuration
For site-wide content like headers/footers:

```typescript
import type { GlobalConfig } from 'payload'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  fields: [
    // Global fields
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
```

## Project-Specific Conventions

### 1. User Management
This project uses a custom authentication system with Supabase:
- `basicUsers` collection for admin/staff authentication
- `patients` collection for patient data
- `clinicStaff` and `plattformStaff` for role-based access
- User types: 'clinic', 'platform', 'patient'

### 2. Medical Domain Collections
Key collections and their relationships:
- `clinics` → `clinicTreatments` → `treatments`
- `doctors` → `doctorSpecialties` → `medicalSpecialties`
- `patients` → `reviews` → `clinics`/`doctors`
- Geographic: `countries` → `cities`

### 4. Plugin Configuration
Standard plugins used in this project:
- `@payloadcms/plugin-seo` for SEO fields
- `@payloadcms/plugin-form-builder` for forms
- `@payloadcms/plugin-search` for search functionality
- `@payloadcms/plugin-redirects` for URL redirects
- `@payloadcms/storage-s3` for file storage

## Development Best Practices

### 1. File Organization
- Collections: `src/collections/CollectionName.ts`
- Access functions: `src/access/functionName.ts`
- Field utilities: `src/fields/fieldName.ts`
- Hooks: `src/hooks/hookName.ts`
- Components: `src/components/ComponentName/`

### 2. TypeScript Usage
Always use proper TypeScript types:

```typescript
import type { CollectionConfig, GlobalConfig, Field } from 'payload'
import type { User } from '@/payload-types'
```

### 3. Import Patterns
Use consistent import patterns:

```typescript
// PayloadCMS imports
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// Local utilities
import { slugField } from '@/fields/slug'
import { defaultLexical } from '@/fields/defaultLexical'
```

### 4. Field Descriptions
Always add helpful descriptions for platform and for clinic users:

```typescript
admin: {
  description: 'Clear description of what this field does and how to use it'
}
```

### 5. Logging Best Practices
Use appropriate logging methods based on the context:

```typescript
// Server-side code - always use payload.logger
import payload from 'payload'

// In hooks, endpoints, or server-side functions
payload.logger.info('Information message')
payload.logger.warn('Warning message') 
payload.logger.error('Error message', { error: errorObject })

// Client-side code - use console methods
console.log('Client-side debug info')
console.warn('Client-side warning')
console.error('Client-side error')
```

### 6. Quality Assurance Process
When finishing implementation as an agent, always run quality checks:

```bash
# Run linting checks
pnpm lint

# Run TypeScript type checking
npx tsc --noEmit

# Fix linting issues if needed
pnpm lint:fix
```

### 7. Implementation Workflow
Always follow this structured approach:

1. **Research Phase**: Research PayloadCMS and Supabase documentation online for the latest features and best practices
2. **Planning Phase**: Create a detailed implementation plan covering:
   - Files to be created/modified
   - Dependencies needed
   - Testing approach
   - Potential edge cases
3. **Approval Phase**: Present the plan and ask for approval before starting implementation
4. **Implementation Phase**: Execute the plan with incremental commits
5. **Validation Phase**: Run `pnpm lint` and `npx tsc --noEmit` to ensure code quality

### 8. PayloadCMS Native Features Priority
Always prefer PayloadCMS native features when available:

- Use built-in field types before creating custom ones
- Leverage PayloadCMS hooks instead of external middleware
- Utilize PayloadCMS access control rather than custom auth logic
- Use PayloadCMS validation instead of external validation libraries
- Research PayloadCMS plugins before implementing custom functionality

When in doubt, consult the [PayloadCMS documentation](https://payloadcms.com/docs) for the latest features and patterns.

## Common Mistakes to Avoid

1. **Don't forget required fields**: Always mark essential fields as `required: true`
2. **Index relationship fields**: Add `index: true` to frequently queried relationship fields
3. **Use proper access control**: Don't default to open access unless intentional
4. **Validate user input**: Add validation for user-facing fields
5. **Group related fields**: Use `type: 'group'` or tabs for better UX
6. **Add field descriptions**: Help editors understand field purposes
7. **Use consistent naming**: Follow camelCase for field names, kebab-case for slugs

## Next.js Integration Patterns

### 1. API Routes
PayloadCMS automatically generates REST and GraphQL APIs, but for custom endpoints:

```typescript
// src/endpoints/custom.ts
import { PayloadHandler } from 'payload'

export const customEndpoint: PayloadHandler = async (req, res) => {
  // Custom logic
}
```

### 2. Frontend Data Fetching
Use Payload's Local API for server-side data fetching:

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const data = await payload.find({
  collection: 'posts',
  limit: 10,
})
```

### 3. Authentication Integration
The project uses Supabase for authentication with custom strategy in `@/auth/supabaseStrategy.ts`.

This configuration should help GitHub Copilot understand PayloadCMS patterns and generate appropriate code for this medical platform project.

## Available Terminal Commands for Agent Mode

When working in agent mode, use these specific commands from package.json instead of generic alternatives:

### Development Commands
- `pnpm dev` - Start development server with proper NODE_OPTIONS
- `pnpm build` - Build the application for production
- `pnpm start` - Start production server
- `pnpm dev:prod` - Clean build and start production mode locally

### PayloadCMS Specific Commands
- `pnpm payload` - Access PayloadCMS CLI
- `pnpm generate` - Generate both import map and TypeScript types
- `pnpm generate:types` - Generate TypeScript types from collections
- `pnpm generate:importmap` - Generate import map for collections

### Database Operations
- `pnpm migrate` - Run database migrations
- `pnpm reset:db` - Reset database with fresh migrations
- `pnpm generateDBFromScratch` - Complete database regeneration (deletes existing migrations) use DB_FRESH="true" to reset DB and delete and then regenerate migrations

### Build and Quality Assurance Commands
- `pnpm lint` - Run ESLint checks for code quality
- `pnpm lint:fix` - Automatically fix ESLint issues
- `npx tsc --noEmit` - Run TypeScript type checking without emitting files
- `pnpm postbuild` - Generate sitemap after build
- `pnpm ci` - CI/CD build command (handles DB_FRESH environment variable)

### Utility Commands
- `pnpm reinstall` - Clean reinstall of dependencies
- `pnpm ii` - Ignore workspace install (for troubleshooting)
- `pnpm test` - Currently placeholder (no tests implemented)

### Important Notes:
- Always use `pnpm` instead of `npm` or `yarn`
- All commands include `cross-env NODE_OPTIONS=--no-deprecation` for proper Node.js handling
- For database operations, prefer `pnpm migrate` over direct database commands
- do not touch the `src/migrations` directory directly, to migrate changes use `pnpm migrate` to apply migrations or `pnpm reset:db` to reset the database
- do not touch the `src/payload-types.ts`, use `pnpm generate:types` after collection changes to update TypeScript definitions
- Use `pnpm dev` for development, not `next dev` directly
- **Always run `pnpm lint` and `npx tsc --noEmit` before completing any implementation to ensure code quality**