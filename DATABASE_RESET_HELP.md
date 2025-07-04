# Database Reset Solution

Your PR is not working due to database issues? Here's how to fix it:

## 🚀 Quick Fix (Most Common Solution)

```bash
# 1. Setup environment (if not done already)
cp .env.example .env.local
# Edit .env.local to add DATABASE_URI and PAYLOAD_SECRET

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Reset database
pnpm reset:db

# 4. Start development
pnpm dev
```

## 📋 Step-by-Step Instructions

### 1. **Environment Setup** (Required First Time)
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local and set these variables:
DATABASE_URI=postgresql://postgres:password@localhost:5432/findmydoc-portal
PAYLOAD_SECRET=your-very-long-secure-secret-key-here
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

### 2. **Install Dependencies**
```bash
# Enable pnpm (if needed)
corepack enable && corepack prepare pnpm@10.12.3 --activate

# Install packages
pnpm install
```

### 3. **Start Database**
```bash
# Option A: Using Docker (Recommended)
docker compose up -d postgres

# Option B: Local PostgreSQL
sudo systemctl start postgresql
```

### 4. **Reset Database**
```bash
# Standard reset (drops data, re-runs migrations)
pnpm reset:db

# Nuclear option (if standard reset fails)
pnpm run generateDBFromScratch
```

### 5. **Verify Success**
```bash
# Check migration status
pnpm payload migrate:status

# Start development server
pnpm dev

# Visit http://localhost:3000/admin
```

## 🛠️ Test Your Setup

Run our diagnostic script to check everything:
```bash
./scripts/test-db-reset.sh
```

## 🔥 If Nothing Works (Nuclear Options)

### Complete Database Rebuild
```bash
# Stop everything
docker compose down -v

# Start fresh
docker compose up -d postgres

# Wait a moment for postgres to start, then:
pnpm run generateDBFromScratch
```

### Manual Database Drop
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres

# Drop and recreate database
DROP DATABASE IF EXISTS "findmydoc-portal";
CREATE DATABASE "findmydoc-portal";
\q

# Then reset
pnpm reset:db
```

## 📚 Need More Help?

- **Quick Reference**: [docs/database-reset-quick-reference.md](docs/database-reset-quick-reference.md)
- **Detailed Troubleshooting**: [docs/database-reset-troubleshooting.md](docs/database-reset-troubleshooting.md)
- **Original Documentation**: [docs/database-reset.md](docs/database-reset.md)

## 🎯 Common Error Solutions

| Error | Solution |
|-------|----------|
| `pnpm: command not found` | `corepack enable && corepack prepare pnpm@10.12.3 --activate` |
| `Error: missing secret key` | Add `PAYLOAD_SECRET` to `.env.local` |
| `cannot connect to Postgres` | Start PostgreSQL: `docker compose up -d postgres` |
| `Migration failed` | Use nuclear option: `pnpm run generateDBFromScratch` |
| `Permission denied` | Check `DATABASE_URI` in `.env.local` |

---

**Still stuck?** Share the error message and we'll help you debug it!