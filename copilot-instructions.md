# GitHub Copilot Instructions for FindMyDoc Platform

## Project Overview
This is the FindMyDoc platform website, a PayloadCMS-powered application for medical practice discovery and content management. The platform helps users find doctors and medical clinics while providing a robust content management system for healthcare providers.

## Technology Stack
- **Backend**: PayloadCMS v3.42.0 with PostgreSQL
- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS v3.4
- **Storage**: S3-compatible storage via Supabase
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: PayloadCMS built-in auth

## Key Architecture Patterns

### Collections Structure
- `Users` - System users and authentication
- `Clinics` - Medical clinic entities
- `Doctors` - Doctor profiles and information
- `Pages` - CMS pages with layout builder
- `Posts` - Blog posts and articles
- `Media` - File uploads and media management
- `Categories` - Content categorization
- `Tags` - Content tagging system

### Layout Builder System
Use the block-based layout system for content creation:
- Hero blocks for page headers
- Content blocks for rich text
- Media blocks for images/videos
- Call-to-action blocks
- Archive blocks for content listings

### File Organization
- `/src/collections/` - PayloadCMS collection definitions
- `/src/blocks/` - Reusable content blocks
- `/src/fields/` - Custom field types and configurations
- `/src/hooks/` - PayloadCMS hooks and middleware
- `/src/plugins/` - Plugin configurations
- `/src/app/` - Next.js app router pages
- `/src/components/` - React components
- `/docs/` - Project documentation

## Coding Conventions

### TypeScript
- Use strict TypeScript throughout
- Import types from `payload/types` for PayloadCMS
- Use `RequiredDataFromCollectionSlug` for seeded content
- Prefer type inference where possible

### React Components
- Use functional components with hooks
- Implement proper TypeScript interfaces for props
- Use Tailwind CSS for styling
- Follow Next.js 13+ app router patterns

### PayloadCMS Patterns
- Use hooks for data transformation (`beforeChange`, `afterChange`)
- Implement proper access control functions
- Use versioning and drafts for content management
- Leverage the admin panel customization features

### Database Operations
- Use PayloadCMS APIs for data operations
- Implement proper error handling for database queries
- Use transactions for complex operations
- Follow the migration patterns for schema changes

## Environment Configuration
- `DATABASE_URI` - PostgreSQL connection string
- `PAYLOAD_SECRET` - PayloadCMS encryption key
- `NEXT_PUBLIC_SERVER_URL` - Public server URL
- `S3_*` variables for cloud storage
- `USE_S3_IN_DEV` - Toggle for development storage

## Common Development Tasks

### Adding New Collections
1. Create collection config in `/src/collections/`
2. Add to `payload.config.ts` collections array
3. Generate types with `pnpm generate:types`
4. Run migrations if needed

### Creating Content Blocks
1. Define block config in `/src/blocks/`
2. Create React component for rendering
3. Add to layout builder configuration
4. Update TypeScript types

### Storage Configuration
- Local storage for development
- S3-compatible for production
- Configure in `/src/plugins/index.ts`
- Only collections with `upload` field need S3 config

## Development Workflow
- Use `pnpm dev` for development server
- Run `pnpm lint` before committing
- Use `pnpm generate` to update types and importmaps
- Docker setup available via `docker-compose.yml`

## Testing Considerations
- No test infrastructure currently implemented
- Focus on manual testing via admin panel
- Verify responsive design across devices
- Test content creation and editing workflows
- Validate storage and media upload functionality

## Performance Notes
- Use Next.js Image component for optimized images
- Implement proper caching strategies
- Leverage PayloadCMS draft preview features
- Consider SSR vs SSG for different page types