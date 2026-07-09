#!/bin/bash
set -euo pipefail

LOG_DIR=/var/log/aegis-gpu
LOG_FILE=${LOG_DIR}/ci-smoke.log
mkdir -p "${LOG_DIR}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] starting aegis smoke pipeline" >> "${LOG_FILE}"
# Deterministic frontend suite (mirrors CI). Browser tests and the exam-coverage
# test are excluded on the host: browser runs are heavy for prod, and
# test_exam_coverage.py needs the repo's docs/ tree, which is not deployed.
python3 -m unittest \
  /var/www/html/tests/test_auth_session_reset.py \
  /var/www/html/tests/test_cluster_sim_state.py \
  /var/www/html/tests/test_cluster_terminal_state.py \
  /var/www/html/tests/test_frontend_smoke.py \
  /var/www/html/tests/test_lab_data_structure.py \
  /var/www/html/tests/test_glossary_coverage.py >> "${LOG_FILE}" 2>&1
python3 -m py_compile /opt/aegis-gpu/aegis_api.py /opt/aegis-gpu/node_scraper.py /opt/aegis-gpu/tests/test_api.py /opt/aegis-gpu/tests/test_api_unittest.py >> "${LOG_FILE}" 2>&1
python3 -m unittest discover -s /opt/aegis-gpu/tests -p 'test_*unittest.py' >> "${LOG_FILE}" 2>&1
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] aegis smoke pipeline completed" >> "${LOG_FILE}"
