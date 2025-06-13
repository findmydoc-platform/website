````instructions
---
applyTo: '*'
---

# PayloadCMS v3 Agent Guidelines

## Project Context
PayloadCMS v3 medical platform (findmydoc-portal) with Next.js, PostgreSQL, Supabase auth. Medical domain: clinics, doctors, patients, treatments, reviews.

## Core Patterns

### Collection Template
```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const Collection: CollectionConfig = {
  slug: 'collection',
  admin: { group: 'Medical Network', useAsTitle: 'name' },
  access: { read: () => true, create: authenticated },
  fields: [/* fields */],
  timestamps: true,
}
```

### Field Types (Essential)
- `type: 'text'` - strings with validation
- `type: 'relationship'` - use `relationTo`, `hasMany`
- `type: 'join'` - two-way relationships
- `type: 'select'` - dropdowns with `options`
- `type: 'richText'` - lexical editor
- `type: 'upload'` - media fields

### Access Control
Import from `@/access/`: `authenticated`, `isPlatformStaff`, `isClinicStaff`, `isPatient`

### Data Model
- `basicUsers` (admin/staff), `patients` (patient data)
- `clinics` → `clinicTreatments` → `treatments`
- `doctors` → `doctorSpecialties` → `medicalSpecialties`
- `countries` → `cities`

## File Organization
- Collections: `src/collections/CollectionName.ts`
- Access: `src/access/functionName.ts`
- Fields: `src/fields/fieldName.ts`
- Hooks: `src/hooks/hookName.ts`

## Agent Commands (pnpm only)
- `pnpm dev` - start development
- `pnpm migrate` - apply database migrations
- `pnpm generate:types` - regenerate types after collection changes
- `pnpm lint` - run linting (**required before completion**)
- `npx tsc --noEmit` - type checking (**required before completion**)

## Critical Rules
- Mark essential fields `required: true`
- Add `index: true` to relationship fields
- Include `admin.description` for clarity
- Use PayloadCMS native features over custom solutions
- Never edit `src/migrations/` or `src/payload-types.ts` directly
- Always run lint + type check before finishing

## Authentication
Supabase via `@/auth/supabaseStrategy.ts`. User types: 'clinic', 'platform', 'patient'

## Logging
Server: `payload.logger.info/warn/error()`. Client: `console.log/warn/error()`

## TypeScript Imports
`import type { CollectionConfig, Field } from 'payload'`
````
