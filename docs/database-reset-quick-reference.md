# Database Reset Quick Reference

## 🚀 Most Common Solution
```bash
pnpm reset:db
```
*Drops all data and re-runs migrations from scratch*

## 🔥 Nuclear Option (when everything is broken)
```bash
pnpm run generateDBFromScratch
```
*Deletes migrations, regenerates schema completely*

## 🐳 Docker Reset (environment issues)
```bash
docker compose down -v
docker compose up -d postgres
docker compose run --rm payload pnpm reset:db
```

## 📋 Quick Diagnostics
```bash
# Check migration status
pnpm payload migrate:status

# Test database connection
psql -h localhost -U postgres -d findmydoc-portal

# Check if PostgreSQL is running
docker compose ps postgres
# or
sudo systemctl status postgresql
```

## 🛠️ Setup Commands
```bash
# Enable pnpm (if not installed)
corepack enable && corepack prepare pnpm@10.12.3 --activate

# Set up environment (REQUIRED)
cp .env.example .env.local
# Edit .env.local to add DATABASE_URI and PAYLOAD_SECRET

# Install dependencies
pnpm install

# Generate types
pnpm run generate

# Start development
pnpm dev
```

## ⚠️ Common Fixes
- **"pnpm not found"**: Run setup commands above
- **"missing secret key"**: Add PAYLOAD_SECRET to .env.local
- **"Database connection failed"**: Start PostgreSQL or Docker
- **"Migration failed"**: Use nuclear option or manually drop database
- **"Permission denied"**: Check DATABASE_URI in .env.local

## 📁 File Locations
- Environment: `.env.local`
- Database config: `src/payload.config.ts`
- Migrations: `src/migrations/`
- Documentation: `docs/database-reset.md`

---
*For detailed troubleshooting, see: `docs/database-reset-troubleshooting.md`*