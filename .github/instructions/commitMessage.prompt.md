# Commit Message Guidelines for FindMyDoc Portal

## Conventional Commits Format
Use the conventional commits specification: `type(scope): description`

### Types
- **feat**: new feature for users
- **fix**: bug fix for users
- **docs**: documentation changes
- **style**: formatting, missing semicolons, etc (no code change)
- **refactor**: code change that neither fixes a bug nor adds a feature
- **perf**: performance improvements
- **test**: adding or updating tests
- **chore**: updating build tasks, package manager configs, etc
- **ci**: changes to CI/CD configuration

### Scopes (optional but recommended)
- **collections**: PayloadCMS collection changes
- **auth**: authentication/authorization
- **api**: API endpoints or server logic
- **ui**: frontend components or styling
- **db**: database migrations or schema
- **config**: configuration files

### Examples
- `feat(collections): add doctor specialties relationship`
- `fix(auth): resolve supabase authentication redirect`
- `docs(api): update clinic endpoints documentation`
- `chore(deps): update payloadcms to v3.1.0`

## Auto-Generated Files - Exclude from Commits
The following files are automatically generated and should **not** be included in manual commits:

### PayloadCMS Generated Files
- `src/payload-types.ts` - auto-generated TypeScript types
- `src/app/(payload)/admin/importMap.js` - admin panel import map
- All files under `src/migrations/` - database migration files

### When These Files Change
- **payload-types.ts**: Generated after collection schema changes via `pnpm generate`
- **importMap.js**: Auto-updated when admin components change
- **migrations**: Created automatically when running `pnpm migrate`

These files will be updated automatically in separate commits or as part of the build process.

## Commit Message Best Practices
- Use imperative mood ("add feature" not "added feature")
- Keep first line under 72 characters
- Add detailed description in body if needed
- Reference issues: "closes #123" or "fixes #456"
- Break changes: add "BREAKING CHANGE:" in footer

## Example Full Commit
```
feat(collections): add patient review system

- Add reviews collection with rating and comment fields
- Create relationship between patients and reviews
- Implement access control for review visibility
- Add validation for rating range (1-5 stars)

Closes #234
```
