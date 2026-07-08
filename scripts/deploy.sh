#!/bin/bash
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKUP_SCRIPT="${REPO_ROOT}/scripts/backup.sh"

detect_version() {
  if git -C "${REPO_ROOT}" describe --tags --exact-match >/dev/null 2>&1; then
    git -C "${REPO_ROOT}" describe --tags --exact-match
    return
  fi
  local branch short_sha
  branch=$(git -C "${REPO_ROOT}" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  short_sha=$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || true)
  if [ -n "${branch}" ] && [ -n "${short_sha}" ]; then
    printf '%s@%s\n' "${branch}" "${short_sha}"
    return
  fi
  printf 'unknown\n'
}

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

DEPLOY_VERSION=$(detect_version)
echo "deploying version ${DEPLOY_VERSION}"

run mkdir -p /opt/aegis-gpu /var/www/html

run rsync -a --delete \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "${REPO_ROOT}/backend/" /opt/aegis-gpu/

run chown -R root:root /opt/aegis-gpu
run find /opt/aegis-gpu -type d -exec chmod 755 {} +
run find /opt/aegis-gpu -type f -exec chmod 644 {} +
if [ "${DRY_RUN}" -eq 1 ]; then
  printf '[dry-run] write %s\n' /opt/aegis-gpu/.aegis-version
else
  printf '%s\n' "${DEPLOY_VERSION}" > /opt/aegis-gpu/.aegis-version
  chown root:root /opt/aegis-gpu/.aegis-version
  chmod 644 /opt/aegis-gpu/.aegis-version
fi

run rsync -a --delete \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "${REPO_ROOT}/frontend/" /var/www/html/

run chown -R root:root /var/www/html
run find /var/www/html -type d -exec chmod 755 {} +
run find /var/www/html -type f -exec chmod 644 {} +

run install -o root -g root -m 644 \
  "${REPO_ROOT}/deploy/nginx/aegis-gpu.conf" \
  /etc/nginx/conf.d/aegis-gpu.conf

run install -o root -g root -m 644 \
  "${REPO_ROOT}/deploy/nginx/aegis-domain.conf" \
  /etc/nginx/conf.d/aegis-domain.conf

if [ "${DRY_RUN}" -eq 1 ]; then
  run bash "${REPO_ROOT}/scripts/ensure_tls_cert.sh" --dry-run
else
  run bash "${REPO_ROOT}/scripts/ensure_tls_cert.sh"
fi

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
