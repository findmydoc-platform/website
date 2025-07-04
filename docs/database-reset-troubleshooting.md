# Database Reset Troubleshooting Guide

## Quick Database Reset Solutions

### Problem: PR not working due to database issues
This guide provides step-by-step solutions for common database reset scenarios.

---

## Option 1: Simple Database Reset (Recommended)

This is the safest and most common approach:

### Prerequisites
1. Ensure you have `pnpm` installed: `corepack enable && corepack prepare pnpm@10.12.3 --activate`
2. **Set up environment variables** (CRITICAL):
   ```bash
   # Copy example environment file
   cp .env.example .env.local
   
   # Edit .env.local to set required variables:
   DATABASE_URI=postgresql://postgres:password@localhost:5432/findmydoc-portal
   PAYLOAD_SECRET=your-secret-key-here-make-it-long-and-secure
   NEXT_PUBLIC_SERVER_URL=http://localhost:3000
   ```
3. Verify your environment: `cat .env.local` should show your DATABASE_URI and PAYLOAD_SECRET

### Steps
```bash
# Navigate to project directory
cd /path/to/your/project

# Reset the database (drops all data and re-runs migrations)
pnpm reset:db

# If you get permission or connection errors, try:
# 1. Make sure PostgreSQL is running
# 2. Check your DATABASE_URI in .env.local
```

---

## Option 2: Complete Schema Rebuild (Nuclear Option)

Use this when you need to completely rebuild the database schema from scratch:

### Warning ⚠️
This will destroy all existing data and migrations!

```bash
# Generate everything from scratch
pnpm run generateDBFromScratch

# Or for a completely fresh start:
DB_FRESH="true" pnpm run generateDBFromScratch
```

---

## Option 3: Using Docker (Isolated Environment)

If you're having environment issues, use Docker:

### Prerequisites
- Docker and Docker Compose installed

### Steps
```bash
# Stop any existing containers
docker compose down

# Remove volumes to completely reset
docker compose down -v

# Start fresh
docker compose up -d postgres

# Wait for postgres to be ready (check with)
docker compose logs postgres

# Run migrations
docker compose run --rm payload pnpm reset:db

# Or start the full application
docker compose up
```

---

## Common Issues and Solutions

### Issue 1: "Database connection failed"
```bash
# Check if PostgreSQL is running
# For local installation:
sudo systemctl status postgresql
# or
pg_isready -h localhost -p 5432

# For Docker:
docker compose ps postgres
docker compose logs postgres
```

**Solution:**
- Start PostgreSQL: `sudo systemctl start postgresql`
- Or start Docker: `docker compose up -d postgres`
- Verify DATABASE_URI in .env.local matches your setup

### Issue 2: "Migration failed" or "Table already exists"
```bash
# Drop and recreate the database manually
# Connect to PostgreSQL as superuser
psql -h localhost -U postgres

-- Inside psql:
DROP DATABASE IF EXISTS "findmydoc-portal";
CREATE DATABASE "findmydoc-portal";
\q

# Then run reset
pnpm reset:db
```

### Issue 3: "Permission denied" errors
```bash
# Make sure the database user has correct permissions
psql -h localhost -U postgres -c "ALTER USER postgres CREATEDB;"

# Or create a dedicated user
psql -h localhost -U postgres -c "CREATE USER findmydoc WITH PASSWORD 'password' CREATEDB;"
```

### Issue 4: "pnpm not found"
```bash
# Install pnpm
corepack enable
corepack prepare pnpm@10.12.3 --activate

# Verify
pnpm --version
```

### Issue 5: "Error: missing secret key"
```bash
# This error means PAYLOAD_SECRET is not set
# Edit your .env.local file:
nano .env.local

# Add this line (replace with a secure random string):
PAYLOAD_SECRET=your-very-long-secure-secret-key-at-least-32-characters

# Or generate a secure secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
```bash
# Make sure you're in the right directory
pwd
ls -la package.json

# Install dependencies first
pnpm install

# Generate types and import map
pnpm run generate
```

---

## Environment-Specific Solutions

### Local Development
```bash
# Standard reset
pnpm reset:db

# If that fails, try the Docker approach
docker compose down -v
docker compose up -d postgres
docker compose run --rm payload pnpm reset:db
```

### Preview/Staging Environment
```bash
# Pull environment variables
vercel pull --environment=preview --yes

# Build with fresh database
DB_FRESH="true" vercel build --target=preview
```

### Production Environment
⚠️ **DANGER ZONE** ⚠️
- Production resets require approval from Sebastian Schütze
- Always backup before resetting production
- Use staging environment to test first

---

## Verification Steps

After running any reset command, verify success:

```bash
# Check if migrations ran successfully
pnpm payload migrate:status

# Start the development server
pnpm dev

# Visit http://localhost:3000/admin to verify
# You should see the admin login page
```

---

## Quick Reference Commands

```bash
# Basic reset (most common)
pnpm reset:db

# Nuclear option (complete rebuild)
pnpm run generateDBFromScratch

# Check migration status
pnpm payload migrate:status

# Create new migration
pnpm payload migrate:create

# Apply pending migrations only
pnpm migrate

# Development server
pnpm dev

# Type checking and linting
pnpm check
```

---

## Still Having Issues?

1. **Check the logs**: Look at the error messages carefully
2. **Docker logs**: `docker compose logs postgres` and `docker compose logs payload`
3. **Database connection**: Test with `psql -h localhost -U postgres -d findmydoc-portal`
4. **Environment variables**: Verify `.env.local` has correct DATABASE_URI
5. **Clean install**: `rm -rf node_modules && pnpm install`

If none of these solutions work, please share:
- The exact error message
- Your operating system
- Whether you're using Docker or local PostgreSQL
- Output of `pnpm payload migrate:status`