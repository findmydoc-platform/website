# Medical Platform (findmydoc-portal)

## Technology Stack

- **Backend**: PayloadCMS (v3.x)
- **Frontend**: Next.js (v14+, App Router)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel for frontend, Supabase for backend
- **Version Control**: GitHub
- **Package Manager**: pnpm
- **Components**: shadcn/ui, Tailwind CSS, Lucide icons
- **Testing**: Vitest
- **Language**: TypeScript (strict)
- **Design Principles**: Atomic Design: Components, Organisms (Payloadcms Blocks), Templates, Pages

PayloadCMS v3 with Next.js frontend, PostgreSQL, Supabase auth. Manages clinics, doctors, patients, treatments, reviews.

## Core Patterns

### Collection Structure Example

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const MyCollection: CollectionConfig = {
  slug: 'myCollection',
  admin: {
    group: 'Choose a group that makes sense',
    useAsTitle: 'name',
    description: 'A brief description of the collection from business perspective',
  },
  access: { read: () => true, create: authenticated },
  fields: [
    /* fields */
  ],
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

## **1. Core Principles**

### **1.1. Technology Stack**

Solutions **MUST** use only this stack:

- **Backend:** PayloadCMS (v3.x)
- **Database:** PostgreSQL (via Supabase)
- **Auth:** Supabase Auth
- **Frontend:** Next.js (v14+, App Router)
- **UI:** shadcn/ui, Tailwind CSS
- **Testing:** Vitest
- **Language:** TypeScript (strict)

### **1.2. Code Quality**

- **Clarity:** Write clean, readable code with descriptive names.
- **Modularity:** Decompose logic into small, reusable units.
- **Reuse:** **MUST** reuse existing code (utilities, types, components) to avoid duplication.
- **Simplicity:** Generate simple solutions. Avoid over-engineering.
- **Documentation:** Add JSDoc to non-trivial functions, exported types, and props.

### **1.3. Guiding Principle: Payload is the Head**

PayloadCMS is the source of truth (content, logic, validation). The frontend is a pure API consumer. **MUST NOT** put business logic or validation in the frontend; use Payload hooks instead.

## **2. Backend: PayloadCMS**

Use native Payload features extensively.

### **2.1. Content Structure**

- **Collections:** For repeatable content (e.g., blog posts). Path: `/src/collections`.
- **Globals:** For singleton content (e.g., site settings). Path: `/src/globals`.
- **Typing:** **MUST** use `CollectionConfig` or `GlobalConfig`.

### **2.2. Business Logic: Hooks**

Business Logic: **MUST** be in Payload hooks (`beforeChange`, `afterChange`, etc.) for all server-side logic, validation, and side effects.

### **2.3. Security: Access Control**

Define authorization in the `access` property on Collections, Globals, and Fields, using `req.user`.

## **3. CRITICAL: Database Migration Workflow**

This workflow is mandatory.

### **3.1. The Rule: No Direct Schema Changes**

You **SHALL NOT** generate raw SQL (`CREATE TABLE`) or use `drizzle-kit`. The schema is managed **only** by Payload's CLI. Bypassing this is a critical error.

### **3.2. The Correct Workflow**

After changing a Collection or Global, instruct the developer to run:

1. `pnpm payload migrate:create <migration-name>` (Generates migration)
2. `pnpm payload migrate` (Applies migration)

## **4. Authentication: Supabase & Payload**

### **4.1. Architecture**

- **Truth Source:** Supabase Auth for identity.
- **Frontend:** Next.js uses `@supabase/ssr`.
- **API:** Supabase JWT **MUST** be in the `Authorization: Bearer <token>` header.
- **Payload:** Validates JWT, finds/creates a user, and sets `req.user` for access control.

### **4.2. Users Collection Config**

- **Disable Local Strategy:** Set `auth: { disableLocalStrategy: true }`.
- **Link to Supabase:** Add a read-only `supabaseId` text field for the Supabase `sub` claim.

### **4.3. Custom Auth Strategy**

The `authenticate` function in `auth.strategies` **MUST**:

1. Extract JWT from the `Authorization` header.
2. Verify token with `SUPABASE_JWT_SECRET`.
3. Extract `sub` and `email` claims.
4. Find user by `supabaseId` (`sub` claim) or create one if missing (JIT Provisioning).
5. Return the user document, or `null` on failure.

## **5. Frontend: Atomic Design**

### **5.1. Component File Structure**

- `/src/components/ui`: Unedited `shadcn/ui` components.
- `/src/components/atoms`: Custom, indivisible, stateless UI elements (e.g., `Logo`).
- `/src/components/molecules`: Simple compositions of atoms (e.g., `SearchForm`).
- `/src/components/organisms`: Complex UI components, often mapping to a Payload Block. Can fetch data.
- `/src/components/templates`: Page layouts composed of organisms.
- `/app/**/page.tsx`: Routes that fetch data and render templates/organisms.

### **5.2. Working with shadcn/ui**

- Customize components by editing files in `/src/components/ui`.
- Use CVA (`class-variance-authority`) for style variants instead of creating simple wrappers.

### **5.3. RSC First**

**MUST** prioritize React Server Components. Use `'use client'` only when necessary for interactivity, pushing it to the leaves of the component tree.

## **6. Bridge: Payload Blocks to Frontend Organisms**

### **6.1. Block-Organism Mapping**

A Payload Block's `slug` **MUST** match its React Organism's filename (e.g., `slug: 'hero'` -> `HeroBlock.tsx`).

### **6.2. Dynamic Block Renderer**

A central `/src/components/templates/Blocks.tsx` component dynamically renders blocks from the API using a lookup map between `blockType` and the React component.

### **6.3. Block-Organism Reference Table**

| Payload Block `slug` | Frontend Organism (`/src/components/organisms/`) | Key Fields                                              |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `hero`               | `HeroBlock.tsx`                                  | `heading`, `subheading`, `backgroundImage`, `ctaButton` |
| `content`            | `ContentBlock.tsx`                               | `richText`                                              |
| `media`              | `MediaBlock.tsx`                                 | `mediaFile`, `size`, `caption`                          |
| `cta`                | `CtaBlock.tsx`                                   | `title`, `text`, `buttonLink`, `buttonText`             |
| `testimonial`        | `TestimonialBlock.tsx`                           | `quote`, `authorName`, `authorImage`, `authorTitle`     |

## **7. Testing: Vitest**

### **7.1. Setup**

- Test files **MUST** be co-located with source files, ending in `.test.ts(x)`.
- Configure Vitest with the `jsdom` environment.

### **7.2. Unit Tests (Atoms, Molecules)**

- Use `@testing-library/react` for rendering and `@testing-library/jest-dom` for assertions.
- Mock dependencies and props with `vi.fn()`.

### **7.3. Integration Tests (Organisms, Pages)**

- **MUST** mock all API calls using **Mock Service Worker (MSW)**.
- Test data-fetching components for loading, success, and error states.
