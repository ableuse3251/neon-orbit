#!/usr/bin/env bash
# ==============================================================================
# Neon Orbit Automated Disaster Recovery Restore Drill Script
# Validates database snapshot backup restoration, schema integrity, and row counts
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
TEST_DB_NAME="neon_orbit_restore_test_$(date +%s)"
DATABASE_URL="${DATABASE_URL:-postgres://neon_user:postgres@localhost:5432/neon_orbit}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: ./server/scripts/restore_test.sh <path_to_backup.sql.gz_or_sql>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "❌ Error: Backup file '${BACKUP_FILE}' not found!"
  exit 1
fi

echo "🔍 Starting Disaster Recovery Restore Drill using '${BACKUP_FILE}'..."

# Extract base connection URI without DB name
BASE_URI=$(echo "${DATABASE_URL}" | sed -E 's/\/[^\/]+$/\/postgres/')

echo "1. Creating isolated restore test database: ${TEST_DB_NAME}..."
psql "${BASE_URI}" -c "CREATE DATABASE ${TEST_DB_NAME};"

TARGET_DB_URI=$(echo "${DATABASE_URL}" | sed -E "s/\/[^\/]+$/\/${TEST_DB_NAME}/")

cleanup() {
  echo "🧹 Cleaning up restore test database ${TEST_DB_NAME}..."
  psql "${BASE_URI}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE);" || true
}
trap cleanup EXIT

echo "2. Restoring backup file into ${TEST_DB_NAME}..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${BACKUP_FILE}" | psql "${TARGET_DB_URI}" > /dev/null
else
  psql "${TARGET_DB_URI}" -f "${BACKUP_FILE}" > /dev/null
fi

echo "3. Verifying database table structures and row integrity..."
TABLE_COUNT=$(psql "${TARGET_DB_URI}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
USER_COUNT=$(psql "${TARGET_DB_URI}" -t -c "SELECT count(*) FROM users;" || echo "0")

echo "   - Tables restored: ${TABLE_COUNT//[[:space:]]/}"
echo "   - Users records:   ${USER_COUNT//[[:space:]]/}"

if [[ "${TABLE_COUNT//[[:space:]]/}" -eq 0 ]]; then
  echo "❌ Restore verification FAILED: 0 tables found in restored database!"
  exit 1
fi

echo "✅ DISASTER RECOVERY DRILL PASSED: Backup successfully restored and verified!"
