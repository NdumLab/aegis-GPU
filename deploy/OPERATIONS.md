# Aegis Production Operations

This deployment model treats the repo as the source of truth and the live host as:

- backend code in `/opt/aegis-gpu`
- frontend assets in `/var/www/html`
- runtime env in `/etc/aegis-gpu/aegis.env`
- nginx config in `/etc/nginx/conf.d/aegis-gpu.conf`
- systemd unit in `/etc/systemd/system/aegis-gpu.service`

## Backup

Run:

```bash
sudo bash /home/henry/aegis-gpu/scripts/backup.sh
```

Dry-run:

```bash
sudo bash /home/henry/aegis-gpu/scripts/backup.sh --dry-run
```

This creates a timestamped snapshot under `/var/backups/aegis-gpu/` including:

- `/opt/aegis-gpu`
- `/var/www/html`
- `/etc/aegis-gpu`
- live nginx and systemd config
- Aegis TLS certificate and private key
- Alertmanager config and SMTP secret file
- Fail2ban jail and filter files
- `/home/henry/docker/docker-compose.yml`

## Deploy

Run:

```bash
sudo bash /home/henry/aegis-gpu/scripts/deploy.sh
```

Dry-run:

```bash
sudo bash /home/henry/aegis-gpu/scripts/deploy.sh --dry-run
```

Deploy does three things:

1. Takes a backup first.
2. Syncs repo backend to `/opt/aegis-gpu` and frontend to `/var/www/html`.
3. Installs repo nginx and systemd files, ensures the TLS certificate covers the host's current names and active IP addresses, reloads systemd, validates nginx, and restarts `nginx` and `aegis-gpu`.

The backup path for the last deploy is recorded in `/var/lib/aegis-gpu/last-deploy-backup`.

## Rollback

Rollback to the last deploy backup:

```bash
sudo bash /home/henry/aegis-gpu/scripts/rollback.sh
```

Rollback to a specific backup:

```bash
sudo bash /home/henry/aegis-gpu/scripts/rollback.sh /var/backups/aegis-gpu/<timestamp>
```

Dry-run:

```bash
sudo bash /home/henry/aegis-gpu/scripts/rollback.sh --dry-run
```

Rollback restores the live code and config, runs `systemctl daemon-reload`, validates nginx with `nginx -t`, and restarts:

- `nginx`
- `aegis-gpu`
- `alertmanager`
- `fail2ban`

## Restore

Direct restore without using rollback:

```bash
sudo bash /home/henry/aegis-gpu/scripts/restore.sh /var/backups/aegis-gpu/<timestamp>
```

Dry-run:

```bash
sudo bash /home/henry/aegis-gpu/scripts/restore.sh --dry-run /var/backups/aegis-gpu/<timestamp>
```

Use this for host recovery, config recovery, or surgical restore to a known-good snapshot.

## Release Checklist

Before deployment:

- `python3 -m unittest /home/henry/aegis-gpu/frontend/tests/test_auth_session_reset.py /home/henry/aegis-gpu/frontend/tests/test_cluster_sim_state.py /home/henry/aegis-gpu/frontend/tests/test_cluster_terminal_state.py /home/henry/aegis-gpu/frontend/tests/test_frontend_smoke.py /home/henry/aegis-gpu/frontend/tests/test_lab_data_structure.py -v`
- `AEGIS_BROWSER_PROOF_SCENARIOS=study_progress_empty,cluster_fleet_layout,lab_terminal_nvlink,ecc_bad python3 -m unittest /home/henry/aegis-gpu/frontend/tests/test_frontend_browser_proof.py -v`
- `python3 -m py_compile /home/henry/aegis-gpu/backend/log-analizer.py /home/henry/aegis-gpu/backend/node_scraper.py`

After deployment:

- `curl -sS http://127.0.0.1:8000/api/v1/status`
- `curl -kfsSI https://127.0.0.1/`
- `openssl x509 -in /etc/ssl/certs/aegis-gpu.crt -noout -ext subjectAltName`
- `systemctl status --no-pager nginx aegis-gpu alertmanager fail2ban`

## Notes

- `deploy/systemd/aegis-gpu.service` should match the live service unit before release. Do not leave repo/live drift in worker counts or hardening settings.
- `restore.sh` is destructive to the current live tree by design. Always confirm the backup path before running it.
