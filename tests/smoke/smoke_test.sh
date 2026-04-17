#!/usr/bin/env bash
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT"
set -u
PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail(){ echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo '=== Aegis-GPU Smoke Tests ==='

python3 -m py_compile backend/log-analizer.py backend/node_scraper.py >/dev/null 2>&1 && ok 'backend syntax' || fail 'backend syntax'
[ -f frontend/index.html ] && ok 'frontend index present' || fail 'frontend index missing'
[ -f deploy/aegis-gpu.conf ] && ok 'nginx config present' || fail 'nginx config missing'
[ -f deploy/aegis-gpu.service ] && ok 'systemd unit present' || fail 'systemd unit missing'
[ -f deploy/aegis.env.example ] && ok 'env template present' || fail 'env template missing'

for key in JWT_SECRET JWT_HOURS ADMIN_HASH ANALYST_HASH ALLOW_DESTRUCTIVE_REMEDIATION ALLOWED_ORIGINS AEGIS_NODE_HOST AEGIS_NODE_USERNAME AEGIS_AUDIT_LOG_PATH AEGIS_INCIDENTS_DB; do
  grep -q "^${key}=" deploy/aegis.env.example && ok "env template contains ${key}" || fail "env template missing ${key}"
done

if command -v systemctl >/dev/null 2>&1; then
  [ "$(systemctl is-active aegis-gpu 2>/dev/null || true)" = 'active' ] && ok 'aegis-gpu service active' || fail 'aegis-gpu service down'
fi

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t >/dev/null 2>&1 && ok 'nginx config valid' || fail 'nginx config invalid'
fi

HTTP=$(curl -sk -o /dev/null -w '%{http_code}' https://localhost/api/v1/status 2>/dev/null || echo '000')
[ "$HTTP" = '200' ] && ok 'HTTPS /status 200' || fail "/status returned $HTTP"

echo ''
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" = '0' ]
