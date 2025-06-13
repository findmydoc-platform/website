# PayloadCMS v3 + Next.js Medical Platform (findmydoc-portal)

PayloadCMS v3 with Next.js frontend, PostgreSQL, Supabase auth. Manages clinics, doctors, patients, treatments, reviews.

## Core Patterns

### Collection Structure
```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const MyCollection: CollectionConfig = {
  slug: 'myCollection',
  admin: { group: 'Medical Network', useAsTitle: 'name' },
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

### Access Control
Import from `@/access/`: `authenticated`, `isPlatformStaff`, `isClinicStaff`, `isPatient`

### Key Collections
- `basicUsers` (admin/staff auth), `patients` (patient data)
- `clinics` → `clinicTreatments` → `treatments`
- `doctors` → `doctorSpecialties` → `medicalSpecialties`
- `countries` → `cities` (geographic)

## Development Standards

### File Organization
- Collections: `src/collections/CollectionName.ts`
- Access: `src/access/functionName.ts`
- Fields: `src/fields/fieldName.ts`
- Hooks: `src/hooks/hookName.ts`

### TypeScript
Always import: `import type { CollectionConfig, Field } from 'payload'`

### Commands (Use pnpm, not npm)
- `pnpm dev` - development server
- `pnpm migrate` - run database migrations
- `pnpm generate:types` - update TypeScript types after collection changes
- `pnpm lint` - run linting (required before completing work)
- `npx tsc --noEmit` - type checking (required before completing work)

### Required Practices
- Mark essential fields as `required: true`
- Add `index: true` to frequently queried relationship fields
- Include field descriptions in `admin.description`
- Use PayloadCMS native features over custom implementations
- Never edit `src/migrations/` or `src/payload-types.ts` directly
- Always run `pnpm lint` and `npx tsc --noEmit` before completing implementations

### Logging
Server-side: `payload.logger.info/warn/error()`. Client-side: `console.log/warn/error()`

### Authentication
Supabase integration via `@/auth/supabaseStrategy.ts`. User types: 'clinic', 'platform', 'patient'
