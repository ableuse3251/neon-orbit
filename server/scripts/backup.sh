#!/usr/bin/env bash
# ==============================================================================
# Neon Orbit Database Backup & Disaster Recovery Script
# Automates PostgreSQL database snapshots, compression, and retention
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/neon_orbit_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ Error: DATABASE_URL environment variable is not defined!"
  exit 1
fi

echo "📦 Starting Neon Orbit database snapshot: ${BACKUP_FILE}..."

# Perform pg_dump compressed with gzip
pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${BACKUP_FILE}"

echo "✅ Backup successfully created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than RETENTION_DAYS
echo "🧹 Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "neon_orbit_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -delete

echo "✨ Backup maintenance completed."

# Example restore command:
# gunzip -c backups/neon_orbit_YYYYMMDD_HHMMSS.sql.gz | psql "${DATABASE_URL}"
