#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

remove_runtime_artifacts() {
  local target=$1

  rm -rf \
    "$target/.git" \
    "$target/.github" \
    "$target/__pycache__" \
    "$target/tests/__pycache__" \
    "$target/tests/backend/__pycache__" \
    "$target/tests/frontend/__pycache__" \
    "$target/.pytest_cache"

  find "$target" -depth -type d \( -name __pycache__ -o -name .pytest_cache \) -exec rm -rf {} +
  find "$target" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete
}

echo '==> Sync backend to /opt/aegis-gpu'
install -d -m 755 /opt/aegis-gpu /opt/aegis-gpu/tests /opt/aegis-gpu/nvidia_kb
install -m 644 "$ROOT/backend/log-analizer.py" /opt/aegis-gpu/log-analizer.py
install -m 644 "$ROOT/backend/node_scraper.py" /opt/aegis-gpu/node_scraper.py
install -m 644 "$ROOT/backend/requirements.txt" /opt/aegis-gpu/requirements.txt
install -m 644 "$ROOT/backend/pytest.ini" /opt/aegis-gpu/pytest.ini
install -m 644 "$ROOT/backend/README.md" /opt/aegis-gpu/README.md
install -m 644 "$ROOT/backend/nvidia_kb/xid_reference.json" /opt/aegis-gpu/nvidia_kb/xid_reference.json
install -m 644 "$ROOT/backend/nvidia_kb/gb200_maintenance.txt" /opt/aegis-gpu/nvidia_kb/gb200_maintenance.txt
install -m 644 "$ROOT/tests/backend/test_api.py" /opt/aegis-gpu/tests/test_api.py
install -m 644 "$ROOT/tests/backend/test_api_unittest.py" /opt/aegis-gpu/tests/test_api_unittest.py
remove_runtime_artifacts /opt/aegis-gpu

echo '==> Sync frontend to /var/www/html'
install -d -m 755 /var/www/html /var/www/html/css /var/www/html/js /var/www/html/fonts /var/www/html/tests
install -m 644 "$ROOT/frontend/index.html" /var/www/html/index.html
install -m 644 "$ROOT/frontend/package.json" /var/www/html/package.json
install -m 644 "$ROOT/frontend/css/styles.css" /var/www/html/css/styles.css
install -m 644 "$ROOT/frontend/js/app.js" /var/www/html/js/app.js
install -m 644 "$ROOT/frontend/js/explain.js" /var/www/html/js/explain.js
install -m 644 "$ROOT/frontend/js/hardware.js" /var/www/html/js/hardware.js
install -m 644 "$ROOT/frontend/js/labs.js" /var/www/html/js/labs.js
install -m 644 "$ROOT/frontend/js/learning.js" /var/www/html/js/learning.js
install -m 644 "$ROOT/frontend/js/render.js" /var/www/html/js/render.js
install -m 644 "$ROOT/tests/frontend/test_frontend_smoke.py" /var/www/html/tests/test_frontend_smoke.py
install -m 644 "$ROOT/tests/frontend/test_frontend_browser_smoke.py" /var/www/html/tests/test_frontend_browser_smoke.py
for font in "$ROOT"/frontend/fonts/*.woff2; do
  install -m 644 "$font" /var/www/html/fonts/
done
remove_runtime_artifacts /var/www/html

echo '==> Sync deploy config'
install -d -m 755 /etc/nginx/conf.d /etc/systemd/system /etc/aegis-gpu /etc/logrotate.d
install -m 644 "$ROOT/deploy/aegis-gpu.conf" /etc/nginx/conf.d/aegis-gpu.conf
install -m 644 "$ROOT/deploy/aegis-gpu.service" /etc/systemd/system/aegis-gpu.service
install -m 644 "$ROOT/deploy/aegis-gpu.logrotate" /etc/logrotate.d/aegis-gpu
if [ ! -f /etc/aegis-gpu/aegis.env ]; then
  install -m 640 "$ROOT/deploy/aegis.env.example" /etc/aegis-gpu/aegis.env
  echo 'Created /etc/aegis-gpu/aegis.env from example; replace placeholder secrets before production use.'
fi

echo '==> Provision runtime state paths'
if id -u aegis >/dev/null 2>&1; then
  install -d -m 750 -o aegis -g aegis /var/log/aegis-gpu /var/lib/aegis-gpu
else
  install -d -m 750 /var/log/aegis-gpu /var/lib/aegis-gpu
  echo "WARNING: user 'aegis' does not exist yet; runtime directories were created without aegis ownership."
fi

echo '==> Validate and reload services'
nginx -t
systemctl daemon-reload
systemctl reload nginx
systemctl restart aegis-gpu

echo '==> Deployment complete'
