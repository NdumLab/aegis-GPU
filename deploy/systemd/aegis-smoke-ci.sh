#!/bin/bash
set -euo pipefail

LOG_DIR=/var/log/aegis-gpu
LOG_FILE=${LOG_DIR}/ci-smoke.log
mkdir -p "${LOG_DIR}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] starting aegis smoke pipeline" >> "${LOG_FILE}"
python3 -m unittest discover -s /var/www/html/tests -p 'test_*.py' >> "${LOG_FILE}" 2>&1
python3 -m py_compile /opt/aegis-gpu/log-analizer.py /opt/aegis-gpu/node_scraper.py /opt/aegis-gpu/tests/test_api.py /opt/aegis-gpu/tests/test_api_unittest.py >> "${LOG_FILE}" 2>&1
python3 -m unittest discover -s /opt/aegis-gpu/tests -p 'test_*unittest.py' >> "${LOG_FILE}" 2>&1
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] aegis smoke pipeline completed" >> "${LOG_FILE}"
