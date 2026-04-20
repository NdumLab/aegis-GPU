FROM nvidia/cuda:12.2.0-base-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Safe defaults for RunPod — override via pod environment variables
    ACTIVE_LLM=deterministic \
    ALLOWED_ORIGINS=* \
    JWT_HOURS=8 \
    ALLOW_DESTRUCTIVE_REMEDIATION=false

# System deps: Python 3.11, pip, nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3-pip nginx \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# Backend — mirrors /opt/aegis-gpu on bare-metal deploy
COPY backend/ /opt/aegis-gpu/

# Frontend — mirrors /var/www/html on bare-metal deploy
COPY frontend/ /var/www/html/

# RunPod nginx config (HTTP-only; RunPod proxy terminates TLS)
COPY deploy/runpod/nginx-runpod.conf /etc/nginx/conf.d/aegis-gpu.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Runtime directories (no systemd, no aegis service user needed)
RUN mkdir -p /var/log/aegis-gpu /var/lib/aegis-gpu /etc/aegis-gpu

COPY deploy/runpod/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
