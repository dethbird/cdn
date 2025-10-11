#!/usr/bin/env bash
# Reset SQLite DB from db/reset.sql and remove contents under public/m/
# Usage: ./scripts/reset_db_and_clean.sh [--yes] [--dry-run]

 # enable strict modes; some /bin/sh implementations (dash) don't support 'pipefail'
 # so fall back to a compatible mode when 'pipefail' isn't available.
 set -euo pipefail 2>/dev/null || set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="$HERE/db/cdn.sqlite"
SQL_FILE="$HERE/db/reset.sql"
M_DIR="$HERE/public/m"

DRY_RUN=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --help|-h) echo "Usage: $0 [--dry-run] [--yes]"; exit 0 ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

if [ ! -f "$SQL_FILE" ]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if [ $DRY_RUN -eq 1 ]; then
  echo "DRY RUN: would run SQL file: $SQL_FILE on DB: $DB_FILE"
  echo "DRY RUN: would remove contents under: $M_DIR"
  exit 0
fi

if [ ! -f "$DB_FILE" ]; then
  echo "DB file does not exist: $DB_FILE" >&2
  read -p "Create new DB file and apply reset.sql? [y/N] " ans
  case "$ans" in
    [Yy]* ) ;;
    *) echo "Aborting."; exit 1 ;;
  esac
fi

if [ $ASSUME_YES -ne 1 ]; then
  echo "About to reset DB ($DB_FILE) using $SQL_FILE and remove contents under $M_DIR"
  read -p "Proceed? [y/N] " ans
  case "$ans" in
    [Yy]* ) ;;
    *) echo "Aborting."; exit 1 ;;
  esac
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 binary not found in PATH. Please install sqlite3 or use the PHP script." >&2
  exit 1
fi

BACKUP="${DB_FILE}.$(date -u +%Y%m%dT%H%M%SZ).bak"
echo "Backing up $DB_FILE -> $BACKUP"
cp -a "$DB_FILE" "$BACKUP"

echo "Applying SQL: $SQL_FILE"
sqlite3 "$DB_FILE" < "$SQL_FILE"

if [ -d "$M_DIR" ]; then
  echo "Removing files under $M_DIR"
  # safely remove contents but keep the directory itself
  find "$M_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
else
  echo "Directory $M_DIR does not exist; nothing to remove"
fi

echo "Done. DB reset and public/m/ cleaned. Backup at: $BACKUP"
