#!/bin/bash
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

BACKUP_ROOT=${AEGIS_BACKUP_ROOT:-/var/backups/aegis-gpu}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="${BACKUP_ROOT}/${TIMESTAMP}"

run() {
  if [ "${DRY_RUN}" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

run mkdir -p "${DEST}"

copy_tree() {
  local src=$1
  local dest=$2
  if [ -e "${src}" ]; then
    run mkdir -p "$(dirname "${dest}")"
    run cp -a "${src}" "${dest}"
  fi
}

copy_tree /opt/aegis-gpu "${DEST}/opt/aegis-gpu"
copy_tree /var/www/html "${DEST}/var/www/html"
copy_tree /etc/aegis-gpu "${DEST}/etc/aegis-gpu"
copy_tree /etc/nginx/conf.d/aegis-gpu.conf "${DEST}/etc/nginx/conf.d/aegis-gpu.conf"
copy_tree /etc/systemd/system/aegis-gpu.service "${DEST}/etc/systemd/system/aegis-gpu.service"
copy_tree /etc/systemd/system/alertmanager.service "${DEST}/etc/systemd/system/alertmanager.service"
copy_tree /etc/systemd/system/alertmanager.service.d "${DEST}/etc/systemd/system/alertmanager.service.d"
copy_tree /etc/alertmanager/alertmanager.yml "${DEST}/etc/alertmanager/alertmanager.yml"
copy_tree /etc/alertmanager/smtp_auth_password "${DEST}/etc/alertmanager/smtp_auth_password"
copy_tree /etc/fail2ban/jail.d/aegis.local "${DEST}/etc/fail2ban/jail.d/aegis.local"
copy_tree /etc/fail2ban/filter.d/aegis-auth.conf "${DEST}/etc/fail2ban/filter.d/aegis-auth.conf"
copy_tree /etc/fail2ban/filter.d/aegis-probes.conf "${DEST}/etc/fail2ban/filter.d/aegis-probes.conf"
copy_tree /home/henry/docker/docker-compose.yml "${DEST}/home/henry/docker/docker-compose.yml"

if [ "${DRY_RUN}" -eq 1 ]; then
  printf '[dry-run] write %s/manifest.txt\n' "${DEST}"
else
cat > "${DEST}/manifest.txt" <<EOF
created_at=${TIMESTAMP}
hostname=$(hostname)
backup_root=${DEST}
EOF
fi

printf '%s\n' "${DEST}"
