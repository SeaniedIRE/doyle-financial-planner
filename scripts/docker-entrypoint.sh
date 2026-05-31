#!/bin/sh
set -e

DATA_DIR="/app/data"
BACKUP_DIR="$DATA_DIR/backups"
DB_FILE="$DATA_DIR/financial_planner.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "======================================"
echo " Doyle Financial Planner — Starting"
echo "======================================"

# Ensure data directories exist
mkdir -p "$DATA_DIR" "$BACKUP_DIR"

# Back up the database before any migration (safe upgrade pattern)
if [ -f "$DB_FILE" ]; then
    echo "📦 Backing up database before startup..."
    cp "$DB_FILE" "$BACKUP_DIR/pre_start_${TIMESTAMP}.db"
    # Keep only last 14 backups
    ls -t "$BACKUP_DIR"/pre_start_*.db 2>/dev/null | tail -n +15 | xargs rm -f
    echo "✓ Backup saved: pre_start_${TIMESTAMP}.db"
fi

# Run Alembic migrations (additive only — never drops data)
echo "🔄 Checking database migrations..."
cd /app/backend
alembic upgrade head
echo "✓ Database up to date"

# Start all processes via supervisor
echo "🚀 Starting services (nginx + uvicorn)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/app.conf
