#!/bin/bash
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi

if [ $# -ne 1 ]; then
  echo "usage: $0 [--dry-run] <backup-dir>" >&2
  exit 1
fi

SRC=$1

if [ ! -d "${SRC}" ]; then
  echo "backup directory not found: ${SRC}" >&2
  exit 1
fi

run() {
  if [ "${DRY_RUN}" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

restore_tree() {
  local src=$1
  local dest=$2
  if [ -e "${src}" ]; then
    run mkdir -p "$(dirname "${dest}")"
    run rm -rf "${dest}"
    run cp -a "${src}" "${dest}"
  fi
}

restore_tree "${SRC}/opt/aegis-gpu" /opt/aegis-gpu
restore_tree "${SRC}/var/www/html" /var/www/html
restore_tree "${SRC}/etc/aegis-gpu" /etc/aegis-gpu
restore_tree "${SRC}/etc/nginx/conf.d/aegis-gpu.conf" /etc/nginx/conf.d/aegis-gpu.conf
restore_tree "${SRC}/etc/ssl/certs/aegis-gpu.crt" /etc/ssl/certs/aegis-gpu.crt
restore_tree "${SRC}/etc/ssl/private/aegis-gpu.key" /etc/ssl/private/aegis-gpu.key
restore_tree "${SRC}/etc/systemd/system/aegis-gpu.service" /etc/systemd/system/aegis-gpu.service
restore_tree "${SRC}/etc/systemd/system/alertmanager.service" /etc/systemd/system/alertmanager.service
restore_tree "${SRC}/etc/systemd/system/alertmanager.service.d" /etc/systemd/system/alertmanager.service.d
restore_tree "${SRC}/etc/alertmanager/alertmanager.yml" /etc/alertmanager/alertmanager.yml
restore_tree "${SRC}/etc/alertmanager/smtp_auth_password" /etc/alertmanager/smtp_auth_password
restore_tree "${SRC}/etc/fail2ban/jail.d/aegis.local" /etc/fail2ban/jail.d/aegis.local
restore_tree "${SRC}/etc/fail2ban/filter.d/aegis-auth.conf" /etc/fail2ban/filter.d/aegis-auth.conf
restore_tree "${SRC}/etc/fail2ban/filter.d/aegis-probes.conf" /etc/fail2ban/filter.d/aegis-probes.conf
restore_tree "${SRC}/home/henry/docker/docker-compose.yml" /home/henry/docker/docker-compose.yml

run systemctl daemon-reload
run nginx -t
run systemctl restart nginx aegis-gpu alertmanager fail2ban

echo "restore completed from ${SRC}"
