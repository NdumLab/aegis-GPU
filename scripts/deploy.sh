#!/bin/bash
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKUP_SCRIPT="${REPO_ROOT}/scripts/backup.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2
  exit 1
fi

run() {
  if [ "${DRY_RUN}" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

if [ "${DRY_RUN}" -eq 1 ]; then
  BACKUP_DIR=$(bash "${BACKUP_SCRIPT}" --dry-run | tail -n 1)
else
  BACKUP_DIR=$(bash "${BACKUP_SCRIPT}")
fi
echo "backup created at ${BACKUP_DIR}"

run mkdir -p /opt/aegis-gpu /var/www/html

run rsync -a --delete \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "${REPO_ROOT}/backend/" /opt/aegis-gpu/

run rsync -a --delete \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "${REPO_ROOT}/frontend/" /var/www/html/

run install -o root -g root -m 644 \
  "${REPO_ROOT}/deploy/nginx/aegis-gpu.conf" \
  /etc/nginx/conf.d/aegis-gpu.conf

run install -o root -g root -m 644 \
  "${REPO_ROOT}/deploy/systemd/aegis-gpu.service" \
  /etc/systemd/system/aegis-gpu.service

run systemctl daemon-reload
run nginx -t
run systemctl restart nginx aegis-gpu

if [ "${DRY_RUN}" -eq 1 ]; then
  printf '[dry-run] write %s\n' /var/lib/aegis-gpu/last-deploy-backup
else
  echo "${BACKUP_DIR}" > /var/lib/aegis-gpu/last-deploy-backup
fi
echo "deploy completed"
