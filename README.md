# Aegis-GPU

Canonical source repository for the Aegis-GPU backend, frontend, deploy configuration, and smoke coverage.

## Layout

- `backend/`: FastAPI backend and local knowledge base
- `frontend/`: static UI served by nginx
- `deploy/`: nginx, systemd, and environment template
- `tests/backend/`: backend unit and API smoke tests
- `tests/frontend/`: frontend regression and browser smoke tests
- `tests/smoke/`: deployment-oriented smoke checks
- `scripts/`: deployment helpers

## Local Verification

Backend syntax and unit smoke:

```bash
python3 -m py_compile backend/log-analizer.py backend/node_scraper.py
python3 -m unittest -v tests/backend/test_api_unittest.py
```

Frontend regression suite:

```bash
python3 -m unittest discover -v -s tests/frontend -p 'test_*.py'
```

Deployment smoke:

```bash
bash tests/smoke/smoke_test.sh
```

## Deployment

Use the deploy helper to copy the canonical repo into the live system paths and reload services:

```bash
sudo bash scripts/deploy.sh
```

This repo is intended to be the source of truth. The live paths under `/opt/aegis-gpu`, `/var/www/html`, and `/etc/...` should be treated as deployment targets.
