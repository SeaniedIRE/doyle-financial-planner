#!/bin/bash
# Manual database backup — run from Unraid terminal or Mac.
# Usage: ./scripts/backup.sh [destination-dir]
# Default destination: ./backups/

set -euo pipefail

DB_PATH="${DB_PATH:-/app/data/financial_planner.db}"
DEST="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DEST}/financial_planner_${TIMESTAMP}.db"

mkdir -p "$DEST"

if [ ! -f "$DB_PATH" ]; then
    echo "Database not found at $DB_PATH"
    exit 1
fi

cp "$DB_PATH" "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# Keep only the 30 most recent backups
ls -t "${DEST}"/financial_planner_*.db 2>/dev/null | tail -n +31 | xargs -r rm --
echo "Old backups pruned. Total kept: $(ls "${DEST}"/financial_planner_*.db 2>/dev/null | wc -l)"
