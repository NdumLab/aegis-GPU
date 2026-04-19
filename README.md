# Aegis-GPU

Canonical source repository for the Aegis-GPU backend, frontend, deploy configuration, and smoke coverage.

## Source Of Truth

Edit code in `~/aegis-gpu` only.

Live paths are deployment targets, not development worktrees:

- `~/aegis-gpu/`: canonical source repository
- `/opt/aegis-gpu/`: deployed backend runtime used by `systemd`
- `/var/www/html/`: deployed frontend served by `nginx`
- `/etc/systemd/system/aegis-gpu.service`: deployed service unit
- `/etc/nginx/conf.d/aegis-gpu.conf`: deployed nginx site config

Legacy copies outside this repo, including `~/log-analizer.py`, `~/node_scraper.py`, `~/nvidia_kb/`, `~/aegis-gpu.bk/`, and `/var/www/html.bk/`, should be treated as historical leftovers unless you explicitly decide to keep them.

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

The deploy helper also removes runtime-only clutter that should not persist in deployment targets, such as `.git/`, `.github/`, `__pycache__/`, `.pytest_cache/`, and `*.pyc`.

## Cleanup

Remove generated files from the source repo without touching deployments:

```bash
make clean
```
