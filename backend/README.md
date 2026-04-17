# Aegis-GPU Backend

Deployed FastAPI backend for the Aegis-GPU production service.

## Scope
- Auth, telemetry, diagnosis, and remediation APIs.
- Grounded local host inspection via `node_scraper.py`.
- Served behind nginx by the `aegis-gpu.service` systemd unit.

## Runtime Contract
- Loads environment from `/etc/aegis-gpu/aegis.env` in production.
- Requires a real `JWT_SECRET` with at least 32 characters.
- Supports `ACTIVE_LLM=deterministic`, `claude`, or `openai`.
- Persists incidents to `/var/lib/aegis-gpu/incidents.db` by default.
- Writes audit logs to `/var/log/aegis-gpu/audit.log` by default.
- Expects `ALLOWED_ORIGINS` to match the public UI origin.

## Local Verification
Run syntax checks with:

```bash
python3 -m py_compile log-analizer.py node_scraper.py
```

Run unit smoke with:

```bash
python3 -m unittest -v ../tests/backend/test_api_unittest.py
```
