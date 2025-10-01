# **GitHub Copilot Instructions for the Project Workspace**

You **MUST** strictly adhere to these guidelines. Your role is to be an expert on our specific tech stack and architecture.

## **1. Core Principles**

### **1.1. Technology Stack**

Confine all solutions to this stack:
- **Backend:** PayloadCMS (v3.x)
- **Database:** PostgreSQL (via Supabase)
- **Auth:** Supabase Auth
- **Frontend:** Next.js (v14+, App Router)
- **UI:** shadcn/ui, Tailwind CSS
- **Testing:** Vitest
- **Language:** TypeScript (strict)

### **1.2. Code Quality**

- **Clarity:** Write clean, readable code with descriptive names.
- **Modularity:** Decompose complex logic into small, reusable units.
- **Reuse:** **MUST** analyze existing code to reuse utilities, types, and components, avoiding duplication.
- **Simplicity:** Generate the simplest possible solution. Avoid over-engineering.
- **Documentation:** MUST add JSDoc to all functions (including hooks and utilities), exported types, and component props. Keep it concise for trivial functions (one-line summary is fine).

### **1.3. Guiding Principle: Payload is the Head**

PayloadCMS is the source of truth for content, business logic, and validation. The Next.js frontend is a pure consumer of the Payload API. **MUST NOT** implement business logic or validation on the frontend; use Payload hooks instead.

## **2. Backend: PayloadCMS**

Maximize the use of native Payload features.

### **2.1. Content Structure**

- **Collections:** For repeatable content (e.g., blog posts). Place in `/src/collections`.
- **Globals:** For singleton content (e.g., site settings). Place in `/src/globals`.
- **Typing:** **MUST** use `CollectionConfig` or `GlobalConfig`.

### **2.2. Business Logic: Hooks**

All server-side logic, validation, and side effects **MUST** be implemented in Payload hooks (`beforeChange`, `afterChange`, etc.).

### **2.3. Security: Access Control**

Define all authorization in the `access` property on Collections, Globals, and Fields, using the `req.user` object.

## **3. CRITICAL: Database Migration Workflow**

This workflow is non-negotiable.

### **3.1. The Rule: No Direct Schema Changes**

You **SHALL NOT** generate raw SQL (e.g., `CREATE TABLE`) or use `drizzle-kit`. The schema is managed exclusively by Payload's CLI. Bypassing this is a critical error.

### **3.2. The Correct Workflow**

After modifying a Collection or Global, instruct the developer to run:
1. `pnpm payload migrate:create <migration-name>` (Generates migration)
2. `pnpm payload migrate` (Applies migration)

## **4. Authentication: Supabase & Payload**

### **4.1. Architecture**

- **Truth Source:** Supabase Auth for identity.
- **Frontend:** Next.js uses `@supabase/ssr`.
- **API:** Supabase JWT **MUST** be in the `Authorization: Bearer <token>` header.
- **Payload:** Validates JWT, finds or creates a user, and sets `req.user` for access control.

### **4.2. Users Collection Config**

- **Disable Local Strategy:** Set `auth: { disableLocalStrategy: true }`.
- **Link to Supabase:** Add a read-only `supabaseId` text field to store the Supabase `sub` claim.

### **4.3. Custom Auth Strategy**

Implement a custom `authenticate` function in `auth.strategies` that:
1. Extracts the JWT from the `Authorization` header.
2. Verifies the token using `SUPABASE_JWT_SECRET`.
3. Extracts `sub` and `email` claims.
4. Finds a user by `supabaseId` (`sub` claim) or creates one if not found (JIT Provisioning).
5. Returns the user document or `null` on failure.

## **5. Frontend: Atomic Design**

### **5.1. Component File Structure**

- `/src/components/ui`: Unedited `shadcn/ui` components.
- `/src/components/atoms`: Custom, indivisible, stateless UI elements (e.g., `Logo`).
- `/src/components/molecules`: Simple compositions of atoms (e.g., `SearchForm`).
- **`/src/components/organisms`**: Complex UI components, often mapping to a Payload Block. Can fetch data.
- `/src/components/templates`: Page layouts composed of organisms.
- `/app/**/page.tsx`: Routes that fetch data and render templates/organisms.

### **5.2. Working with shadcn/ui**

- Customize components by editing files in `/src/components/ui`.
- Use CVA (`class-variance-authority`) to add style variants instead of creating simple wrappers.

### **5.3. RSC First**

**MUST** prioritize React Server Components. Use the `'use client'` directive only when necessary for interactivity, pushing it to the leaves of the component tree.

## **6. Bridge: Payload Blocks to Frontend Organisms**

### **6.1. Block-Organism Mapping**

A Payload Block's `slug` **MUST** match its corresponding React Organism's filename (e.g., `slug: 'hero'` -> `HeroBlock.tsx`).

### **6.2. Dynamic Block Renderer**

A central `/src/components/templates/Blocks.tsx` component dynamically renders a list of blocks from the API. It uses a lookup map to associate a block's `blockType` with its React component.

### **6.3. Block-Organism Reference Table**

| Payload Block `slug` | Frontend Organism (`/src/components/organisms/`) | Key Fields |
| --- | --- | --- |
| `hero` | `HeroBlock.tsx` | `heading`, `subheading`, `backgroundImage`, `ctaButton` |
| `content` | `ContentBlock.tsx` | `richText` |
| `media` | `MediaBlock.tsx` | `mediaFile`, `size`, `caption` |
| `cta` | `CtaBlock.tsx` | `title`, `text`, `buttonLink`, `buttonText` |
| `testimonial` | `TestimonialBlock.tsx` | `quote`, `authorName`, `authorImage`, `authorTitle` |

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
