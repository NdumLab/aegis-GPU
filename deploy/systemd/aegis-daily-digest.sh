#!/bin/bash
# Aegis-GPU daily digest: yesterday's traffic, signups, and feedback,
# pushed to the operator's ntfy topic (AEGIS_NTFY_TOPIC in aegis.env).
# Runs each morning via aegis-daily-digest.timer. Also refreshes the
# GoAccess HTML report at /var/lib/aegis-gpu/stats/report.html.
set -uo pipefail

ENV_FILE=/etc/aegis-gpu/aegis.env
ACCESS_LOG=/var/log/nginx/aegis-access.log
INCIDENTS_DB=/var/lib/aegis-gpu/incidents.db
STATS_DIR=/var/lib/aegis-gpu/stats
LOG_DIR=/var/log/aegis-gpu
LOG_FILE=${LOG_DIR}/digest.log

mkdir -p "${STATS_DIR}" "${LOG_DIR}"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "${LOG_FILE}"; }

NTFY_TOPIC=$(grep -E '^AEGIS_NTFY_TOPIC=' "${ENV_FILE}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)

# --- Window: yesterday, matched by the date string nginx writes ---
DAY_NGINX=$(date -d yesterday '+%d/%b/%Y')
DAY_HUMAN=$(date -d yesterday '+%Y-%m-%d')
START_TS=$(date -d "${DAY_HUMAN} 00:00:00 UTC" +%s)
END_TS=$((START_TS + 86400))

# --- Traffic from the dedicated vhost log (current + most recent rotation) ---
day_lines() {
  cat "${ACCESS_LOG}" "${ACCESS_LOG}.1" 2>/dev/null | grep -F "[${DAY_NGINX}" || true
}
HITS=$(day_lines | wc -l)
VISITORS=$(day_lines | awk '{print $1}' | sort -u | wc -l)
LANDING_HITS=$(day_lines | grep -c '"GET / HTTP' || true)
XIDREF_HITS=$(day_lines | grep -c '"GET /xid-reference.html' || true)

# --- Accounts and feedback from the app database ---
SIGNUPS=0; FEEDBACK_LINE="none"
if [ -f "${INCIDENTS_DB}" ]; then
  SIGNUPS=$(sqlite3 "${INCIDENTS_DB}" \
    "SELECT COUNT(*) FROM users WHERE created_ts >= ${START_TS} AND created_ts < ${END_TS};" 2>/dev/null || echo 0)
  FB=$(sqlite3 "${INCIDENTS_DB}" \
    "SELECT COUNT(*) || ' (avg ' || COALESCE(ROUND(AVG(rating),1),'-') || '/5)'
     FROM feedback WHERE ts >= ${START_TS} AND ts < ${END_TS};" 2>/dev/null || echo "0")
  [ "${FB%% *}" != "0" ] && FEEDBACK_LINE="${FB}"
fi

SUMMARY="${DAY_HUMAN}: ${VISITORS} visitors, ${HITS} hits (landing ${LANDING_HITS}, xid-ref ${XIDREF_HITS}) · signups ${SIGNUPS} · feedback ${FEEDBACK_LINE}"
log "${SUMMARY}"

if [ -n "${NTFY_TOPIC}" ]; then
  curl -fsS -m 10 \
    -H "Title: Aegis-GPU daily digest" \
    -H "Tags: bar_chart" \
    -d "${SUMMARY}" \
    "https://ntfy.sh/${NTFY_TOPIC}" >/dev/null 2>&1 || log "ntfy push failed"
fi

# --- Refresh the GoAccess deep-dive report (all data in the current log) ---
if command -v goaccess >/dev/null 2>&1; then
  # ( … || true ) so a missing rotated log doesn't trip pipefail
  (cat "${ACCESS_LOG}" "${ACCESS_LOG}.1" 2>/dev/null || true) | \
    goaccess - --log-format=COMBINED -o "${STATS_DIR}/report.html" >/dev/null 2>&1 \
    || log "goaccess report failed"
fi

exit 0
