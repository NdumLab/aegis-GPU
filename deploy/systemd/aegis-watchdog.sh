#!/bin/bash
# Aegis-GPU watchdog: self-healing + alerting for a permanently-running VPS.
# Runs every 5 minutes via aegis-watchdog.timer. Alerts on state CHANGES only
# (failure and recovery), so a broken check does not spam every 5 minutes.
#
# Alert channel: ntfy.sh push topic, read from AEGIS_NTFY_TOPIC in
# /etc/aegis-gpu/aegis.env. Subscribe at https://ntfy.sh/<topic> or in the
# ntfy mobile app. Unset the variable to disable remote alerts (logs remain).
set -uo pipefail

LOG_DIR=/var/log/aegis-gpu
LOG_FILE=${LOG_DIR}/watchdog.log
STATE_DIR=/var/lib/aegis-gpu/watchdog
ENV_FILE=/etc/aegis-gpu/aegis.env
PUBLIC_URL=https://aegisgpu.com/api/v1/status
LOCAL_URL=http://127.0.0.1:8000/api/v1/status
CERT_FILE=/etc/letsencrypt/live/aegisgpu.com/cert.pem
BACKUP_ROOT=/var/backups/aegis-gpu
DISK_LIMIT_PCT=90
CERT_MIN_DAYS=14

mkdir -p "${LOG_DIR}" "${STATE_DIR}"

NTFY_TOPIC=""
if [ -f "${ENV_FILE}" ]; then
  NTFY_TOPIC=$(grep -E '^AEGIS_NTFY_TOPIC=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- || true)
fi

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "${LOG_FILE}"
}

notify() {
  local title=$1 body=$2
  log "ALERT: ${title} — ${body}"
  if [ -n "${NTFY_TOPIC}" ]; then
    curl -s -m 10 -H "Title: Aegis-GPU: ${title}" -d "${body}" \
      "https://ntfy.sh/${NTFY_TOPIC}" > /dev/null || log "ntfy publish failed for: ${title}"
  fi
}

# report <check> <OK|FAIL> <detail> — alerts only when the state flips.
report() {
  local check=$1 state=$2 detail=$3
  local state_file="${STATE_DIR}/${check}"
  local prev="OK"
  [ -f "${state_file}" ] && prev=$(cat "${state_file}")
  printf '%s\n' "${state}" > "${state_file}"
  if [ "${state}" = "FAIL" ] && [ "${prev}" != "FAIL" ]; then
    notify "${check} FAILED" "${detail}"
  elif [ "${state}" = "OK" ] && [ "${prev}" = "FAIL" ]; then
    notify "${check} recovered" "${detail}"
  fi
}

# 1. Backend service active (systemd Restart= covers crashes; this covers manual stops)
if systemctl is-active --quiet aegis-gpu; then
  report backend_service OK "aegis-gpu active"
else
  log "aegis-gpu inactive; restarting"
  systemctl restart aegis-gpu
  sleep 5
  if systemctl is-active --quiet aegis-gpu; then
    report backend_service FAIL "aegis-gpu was down; watchdog restarted it successfully"
    report backend_service OK "aegis-gpu restored by watchdog"
  else
    report backend_service FAIL "aegis-gpu down and restart FAILED — manual intervention needed"
  fi
fi

# 2. Backend actually answering (catches hangs where the process is alive but wedged)
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "${LOCAL_URL}" || echo 000)
if [ "${code}" = "200" ]; then
  report backend_health OK "local API 200"
else
  log "local API returned ${code}; restarting aegis-gpu"
  systemctl restart aegis-gpu
  sleep 8
  code2=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "${LOCAL_URL}" || echo 000)
  if [ "${code2}" = "200" ]; then
    report backend_health FAIL "API hung (HTTP ${code}); watchdog restart fixed it"
    report backend_health OK "API responding again after watchdog restart"
  else
    report backend_health FAIL "API returning ${code2} even after restart — manual intervention needed"
  fi
fi

# 3. nginx active (do NOT auto-restart nginx: it serves other vhosts on this box; alert only)
if systemctl is-active --quiet nginx; then
  report nginx_service OK "nginx active"
else
  report nginx_service FAIL "nginx is not active — site is DOWN; investigate before restarting (shared vhosts)"
fi

# 4. Public endpoint through nginx + TLS
pcode=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "${PUBLIC_URL}" || echo 000)
if [ "${pcode}" = "200" ]; then
  report public_endpoint OK "public API 200"
else
  report public_endpoint FAIL "public ${PUBLIC_URL} returned ${pcode} (backend/nginx state logged above)"
fi

# 5. Disk usage — prune old backups and vacuum journal before it becomes an outage
usage=$(df --output=pcent / | tail -n1 | tr -dc '0-9')
if [ "${usage}" -lt "${DISK_LIMIT_PCT}" ]; then
  report disk_space OK "root disk at ${usage}%"
else
  log "disk at ${usage}%; pruning backups beyond newest 10 and vacuuming journal"
  ls -1d "${BACKUP_ROOT}"/*/ 2>/dev/null | sort | head -n -10 | xargs -r rm -rf
  journalctl --vacuum-size=200M > /dev/null 2>&1
  usage2=$(df --output=pcent / | tail -n1 | tr -dc '0-9')
  if [ "${usage2}" -lt "${DISK_LIMIT_PCT}" ]; then
    report disk_space FAIL "disk hit ${usage}%; auto-pruned to ${usage2}%"
    report disk_space OK "disk back under limit at ${usage2}%"
  else
    report disk_space FAIL "disk at ${usage2}% even after pruning — manual cleanup needed"
  fi
fi

# 6. TLS certificate expiry (certbot.timer should renew; this catches silent renewal failure)
if [ -f "${CERT_FILE}" ]; then
  end_epoch=$(date -d "$(openssl x509 -enddate -noout -in "${CERT_FILE}" | cut -d= -f2)" +%s)
  days_left=$(( (end_epoch - $(date +%s)) / 86400 ))
  if [ "${days_left}" -ge "${CERT_MIN_DAYS}" ]; then
    report tls_cert OK "cert valid ${days_left} more days"
  else
    report tls_cert FAIL "TLS cert expires in ${days_left} days — certbot renewal is not working"
  fi
else
  report tls_cert FAIL "cert file missing at ${CERT_FILE}"
fi

log "watchdog sweep complete"
