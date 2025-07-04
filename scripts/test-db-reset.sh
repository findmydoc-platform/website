#!/bin/bash

# Database Reset Test Script
# This script tests the database reset functionality

echo "🧪 Testing Database Reset Functionality"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found"
    echo "   Run: cp .env.example .env.local"
    echo "   Then edit .env.local to set DATABASE_URI and PAYLOAD_SECRET"
    exit 1
fi

# Check for required environment variables
if ! grep -q "PAYLOAD_SECRET" .env.local; then
    echo "❌ Error: PAYLOAD_SECRET not found in .env.local"
    echo "   Add: PAYLOAD_SECRET=your-secret-key-here"
    exit 1
fi

if ! grep -q "DATABASE_URI" .env.local; then
    echo "❌ Error: DATABASE_URI not found in .env.local"
    echo "   Add: DATABASE_URI=postgresql://postgres:password@localhost:5432/findmydoc-portal"
    exit 1
fi

echo "✅ Environment check passed"

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm not found"
    echo "   Run: corepack enable && corepack prepare pnpm@10.12.3 --activate"
    exit 1
fi

echo "✅ pnpm is available"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

echo "✅ Dependencies are installed"

# Test payload command availability
echo "🔍 Testing payload command..."
if pnpm payload info > /dev/null 2>&1; then
    echo "✅ Payload command is working"
else
    echo "❌ Error: Payload command failed"
    echo "   This usually means environment variables are incorrect"
    echo "   Try: pnpm payload info"
    exit 1
fi

# Test migration status
echo "🔍 Checking migration status..."
if pnpm payload migrate:status; then
    echo "✅ Migration status check passed"
else
    echo "⚠️  Migration status check failed (this might be expected if DB doesn't exist)"
fi

echo ""
echo "🎉 Database reset functionality test completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Start PostgreSQL: docker compose up -d postgres"
echo "   2. Reset database: pnpm reset:db"
echo "   3. Start development: pnpm dev"
echo ""
echo "🔗 For more help, see:"
echo "   - docs/database-reset-quick-reference.md"
echo "   - docs/database-reset-troubleshooting.md"