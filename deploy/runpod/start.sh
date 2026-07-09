#!/bin/bash
set -e

mkdir -p /var/log/aegis-gpu /var/lib/aegis-gpu /etc/aegis-gpu

# Validate required secrets before starting
: "${JWT_SECRET:?JWT_SECRET env var must be set}"
: "${ADMIN_HASH:?ADMIN_HASH env var must be set (bcrypt hash of admin password)}"
: "${ANALYST_HASH:?ANALYST_HASH env var must be set (bcrypt hash of analyst password)}"

# Start nginx (daemonized); uvicorn runs in foreground — container exits if uvicorn dies
nginx

cd /opt/aegis-gpu
exec uvicorn "aegis_api:app" \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 1 \
    --log-level info
