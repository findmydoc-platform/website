# Database Reset

## Commands

```bash
# Local reset
pnpm reset payload migrate:fresh

# Generate from scratch (destroys all data)
pnpm run generateDBFromScratch

# Force fresh DB reset
DB_FRESH="true" pnpm run generateDBFromScratch
```

## GitHub Actions

**Manual**: Actions > Reset Database > Run workflow
**CI/CD**: Set `reset_database: true` in workflow dispatch

## Preview Environment

```bash
# Pull preview environment
vercel pull --environment=preview --yes

# Force fresh rebuild
DB_FRESH="true" vercel build --target=preview
```

## Migration Workflow

```bash
# Create migration
pnpm payload migrate:create <name>

# Apply migrations
pnpm payload migrate

# Check status
pnpm payload migrate:status
```

## ⚠️ Warning

- `payload migrate:fresh` and `generateDBFromScratch` destroy ALL data
- Production resets require approval from Sebastian Schütze
- Always backup before running in production
