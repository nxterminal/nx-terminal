#!/bin/bash
# ============================================================
# NX TERMINAL: PROTOCOL WARS — Setup Script
# ============================================================

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  NX TERMINAL: PROTOCOL WARS — Setup             ║"
echo "╚══════════════════════════════════════════════════╝"

# --- 1. Install Python dependencies ---
echo ""
echo "📦 Installing Python dependencies..."
pip install psycopg2-binary --break-system-packages -q 2>/dev/null || pip install psycopg2-binary -q

# --- 2. Check PostgreSQL ---
echo ""
echo "🐘 Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "   ✅ PostgreSQL client found"
else
    echo "   ⚠️  PostgreSQL client not found. Installing..."
    sudo apt-get update -qq && sudo apt-get install -y -qq postgresql postgresql-client
fi

# --- 3. Start PostgreSQL if not running ---
if pg_isready -q 2>/dev/null; then
    echo "   ✅ PostgreSQL is running"
else
    echo "   🔄 Starting PostgreSQL..."
    sudo service postgresql start 2>/dev/null || sudo pg_ctlcluster 15 main start 2>/dev/null || echo "   ⚠️  Could not start PostgreSQL automatically"
fi

# --- 4. Create database ---
echo ""
echo "🗄️  Creating database..."
sudo -u postgres psql -c "CREATE DATABASE nxterminal;" 2>/dev/null || echo "   Database already exists"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true

# --- 5. Run schema ---
echo ""
echo "📋 Running schema..."
PGPASSWORD=postgres psql -U postgres -d nxterminal -f schema.sql
echo "   ✅ Schema created"

# --- 6. Seed test devs ---
echo ""
echo "🌱 Seeding 10 test devs..."
python3 engine.py seed 10

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Setup complete!                              ║"
echo "║                                                  ║"
echo "║  Run the engine:  python3 engine.py              ║"
echo "║  Seed more devs:  python3 engine.py seed 100     ║"
echo "║  Pay salaries:    python3 engine.py salary        ║"
echo "╚══════════════════════════════════════════════════╝"
