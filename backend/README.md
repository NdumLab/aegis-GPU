# Aegis-GPU Backend

Deployed FastAPI backend for the Aegis-GPU production service.

## Scope
- Auth, telemetry, diagnosis, and remediation APIs.
- Grounded local host inspection via `node_scraper.py`.
- Served behind nginx by the `aegis-gpu.service` systemd unit.

## Local Verification
Run syntax checks with:

```bash
python3 -m py_compile log-analizer.py node_scraper.py
```

Run tests with:

```bash
python3 -m pytest
```
