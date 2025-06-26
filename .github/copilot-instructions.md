# Medical Platform (findmydoc-portal)

## Technology Stack
- **Backend**: PayloadCMS v3
- **Frontend**: Next.js
- **Database**: PostgreSQL
- **Authentication**: Supabase
- **Deployment**: Vercel for frontend, Supabase for backend
- **Version Control**: GitHub
- **Package Manager**: pnpm
- **Components**: Tailwind CSS, Radix UI (shadcn/ui), Lucide icons
- **Design Principles**: Atomic Design: Components, Organisms (Payloadcms Blocks), Templates, Pages

PayloadCMS v3 with Next.js frontend, PostgreSQL, Supabase auth. Manages clinics, doctors, patients, treatments, reviews.

## Core Patterns

### Collection Structure Example
```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const MyCollection: CollectionConfig = {
  slug: 'myCollection',
  admin: { group: 'Choose a group that makes sense', useAsTitle: 'name', description: 'A brief description of the collection from business perspective' },
  access: { read: () => true, create: authenticated },
  fields: [/* fields */],
  timestamps: true,
}
```

### Field Types
- `type: 'text'` - strings with validation
- `type: 'relationship'` - relations with `relationTo`, `hasMany`
- `type: 'join'` - two-way relationships
- `type: 'select'` - dropdowns with `options`
- `type: 'richText'` - lexical editor
- `type: 'upload'` - media fields
- `type: 'number'` - numeric fields
- `type: 'checkbox'` - boolean fields
- `type: 'date'` - date/time fields
- `type: 'email'` - email field with validation
- `type: 'point'` - geographic coordinates
- `type: 'code'` - code editor for custom scripts
- `type: 'json'` - JSON data storage

### Representational Fields
- `type: 'collapsible'` - collapsible sections in the admin panel
- `type: 'tabs'` - tabbed sections for organization
- `type: 'row'` - horizontal layout for fields

### Key Collections
- `basicUsers` → `clinicStaff` and `platformStaff`
- `patients`
- `clinics` → `clinicTreatments` → `treatments`
- `doctors` → `doctorSpecialties` → `medicalSpecialties`
- `countries` → `cities` (geographic)

## Development Standards

### File Organization
- Collections: `src/collections/CollectionName.ts`
- Access: `src/access/functionName.ts`
- Fields: `src/fields/fieldName.ts`
- Hooks: `src/hooks/hookName.ts`
- Components: `src/components/ComponentName.ts`
- Utilities: `src/utils/utilityName.ts`
- Authentication: `src/auth/xyz.ts`
- API Endpoints: `src/api/deeperFolder/endpointName.ts`, follow API standard best practice conventions

### Commands (Use pnpm, not npm)
- `pnpm dev` - development server
- `pnpm migrate` - run database migrations
- `pnpm generate` - generate types and importmaps
- `pnpm check` - type checking and linting (required before completing work)

### Required Practices
- Mark essential fields as `required: true`
- Add `index: true` to frequently queried relationship fields
- Include field descriptions in `admin.description`
- Use PayloadCMS native features over custom implementations
- Never edit `src/migrations/` or `src/payload-types.ts` directly
- Always run `pnpm check` before completing implementations

### Logging
Server-side: `payload.logger.info/warn/error()`. Client-side: `console.log/warn/error()`

### Authentication
Supabase integration via `@/auth/supabaseStrategy.ts`. User types: 'clinic', 'platform', 'patient'
