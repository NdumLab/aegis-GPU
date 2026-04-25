#!/bin/bash
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi

STATE_FILE=/var/lib/aegis-gpu/last-deploy-backup

if [ $# -gt 1 ]; then
  echo "usage: $0 [--dry-run] [backup-dir]" >&2
  exit 1
fi

if [ $# -eq 1 ]; then
  BACKUP_DIR=$1
elif [ -f "${STATE_FILE}" ]; then
  BACKUP_DIR=$(cat "${STATE_FILE}")
else
  echo "no rollback target provided and ${STATE_FILE} is missing" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ "${DRY_RUN}" -eq 1 ]; then
  exec bash "${SCRIPT_DIR}/restore.sh" --dry-run "${BACKUP_DIR}"
else
  exec bash "${SCRIPT_DIR}/restore.sh" "${BACKUP_DIR}"
fi
