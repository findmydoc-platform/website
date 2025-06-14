# Database Migration Guide

Handle PayloadCMS database migrations and schema changes.

## Process
1. **Never edit migration files directly** - they are auto-generated
2. Make changes to collection files only
3. Run appropriate migration commands
4. Verify changes and run quality checks

## Commands
- `pnpm migrate` - Apply pending migrations
- `pnpm reset:db` - Reset database with fresh migrations
- `pnpm generateDBFromScratch` - Complete regeneration (use DB_FRESH="true")

## After Collection Changes
1. Save collection file changes
2. Run `pnpm migrate` to apply schema changes
3. Run `pnpm generate:types` to update TypeScript definitions
4. Test the changes
5. Run `pnpm check`

## Troubleshooting
- Migration conflicts: Use `pnpm reset:db` for clean slate
- Type errors after schema changes: Run `pnpm generate:types`
- Development issues: Try `pnpm dev` restart

## Critical Rules
- Never edit `src/migrations/` directory
- Never edit `src/payload-types.ts` manually
- Always backup data before major migrations
- Test migrations in development first

## Data Safety
- Backup important data before destructive operations
- Use `pnpm reset:db` only in development
- Consider migration rollback strategies for production
