#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_TEMPLATE="$ROOT/deploy/aegis.env.example"
ENV_PATH="/etc/aegis-gpu/aegis.env"
TLS_CERT_PATH="/etc/ssl/certs/aegis-gpu.crt"
TLS_KEY_PATH="/etc/ssl/private/aegis-gpu.key"
AEGIS_USER="aegis"

if command -v sudo >/dev/null 2>&1 && [ "${EUID:-$(id -u)}" -ne 0 ]; then
  SUDO=(sudo)
else
  SUDO=()
fi

say() {
  printf "\n==> %s\n" "$1"
}

warn() {
  printf "WARNING: %s\n" "$1" >&2
}

fail() {
  printf "ERROR: %s\n" "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

prompt_default() {
  local label=$1
  local default_value=${2:-}
  local answer
  if [ -n "$default_value" ]; then
    read -r -p "$label [$default_value]: " answer
    printf "%s" "${answer:-$default_value}"
  else
    read -r -p "$label: " answer
    printf "%s" "$answer"
  fi
}

prompt_secret() {
  local label=$1
  local answer
  read -r -s -p "$label: " answer
  printf "\n" >&2
  printf "%s" "$answer"
}

confirm() {
  local prompt=$1
  local default_answer=${2:-Y}
  local suffix='[Y/n]'
  local answer
  if [ "$default_answer" = "N" ]; then
    suffix='[y/N]'
  fi
  read -r -p "$prompt $suffix " answer
  answer=${answer:-$default_answer}
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    n|N|no|NO) return 1 ;;
    *) return 1 ;;
  esac
}

python_bool_import() {
  local module=$1
  python3 -c "import $module" >/dev/null 2>&1
}

run_as_root() {
  if [ ${#SUDO[@]} -gt 0 ]; then
    "${SUDO[@]}" "$@"
  else
    "$@"
  fi
}

ensure_python_packages() {
  say "Checking Python dependencies"
  if python_bool_import fastapi && python_bool_import uvicorn && python_bool_import bcrypt && python_bool_import jose && python_bool_import dotenv && python_bool_import paramiko; then
    printf "Python dependencies already available.\n"
    return 0
  fi
  if ! confirm "Install backend Python dependencies now?" Y; then
    fail "Python dependencies are required before deployment."
  fi
  run_as_root python3 -m pip install -r "$ROOT/backend/requirements.txt"
}

ensure_aegis_user() {
  say "Checking service user '$AEGIS_USER'"
  if id -u "$AEGIS_USER" >/dev/null 2>&1; then
    printf "User '%s' already exists.\n" "$AEGIS_USER"
    return 0
  fi
  if ! confirm "Create system user '$AEGIS_USER'?" Y; then
    fail "The systemd service expects user '$AEGIS_USER'."
  fi
  run_as_root useradd --system --home /opt/aegis-gpu --shell /sbin/nologin "$AEGIS_USER"
}

generate_secret() {
  python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
}

bcrypt_hash() {
  local raw_password=$1
  RAW_PASSWORD="$raw_password" python3 - <<'PY'
import os
import bcrypt
print(bcrypt.hashpw(os.environ["RAW_PASSWORD"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8"))
PY
}

ensure_tls_assets() {
  say "Checking TLS certificate files"
  if [ -f "$TLS_CERT_PATH" ] && [ -f "$TLS_KEY_PATH" ]; then
    printf "TLS certificate and key already exist.\n"
    return 0
  fi

  warn "Expected TLS files are missing: $TLS_CERT_PATH and/or $TLS_KEY_PATH"
  if command -v openssl >/dev/null 2>&1 && confirm "Generate a self-signed certificate for quick testing?" Y; then
    local host_name
    host_name=$(hostname -f 2>/dev/null || hostname)
    run_as_root mkdir -p /etc/ssl/certs /etc/ssl/private
    run_as_root openssl req -x509 -nodes -newkey rsa:2048 \
      -keyout "$TLS_KEY_PATH" \
      -out "$TLS_CERT_PATH" \
      -days 365 \
      -subj "/CN=${host_name}" >/dev/null 2>&1
    run_as_root chmod 600 "$TLS_KEY_PATH"
    printf "Generated self-signed certificate for host %s.\n" "$host_name"
    return 0
  fi

  warn "nginx will not start with the shipped config until valid TLS assets are present."
}

read_env_value() {
  local key=$1
  if [ ! -f "$ENV_PATH" ]; then
    return 0
  fi
  if [ -r "$ENV_PATH" ]; then
    awk -F= -v key="$key" '$1 == key {print substr($0, index($0, "=") + 1)}' "$ENV_PATH" 2>/dev/null || true
  else
    run_as_root awk -F= -v key="$key" '$1 == key {print substr($0, index($0, "=") + 1)}' "$ENV_PATH" 2>/dev/null || true
  fi
}

write_env_file() {
  say "Preparing environment configuration"
  [ -f "$ENV_TEMPLATE" ] || fail "Missing env template at $ENV_TEMPLATE"

  local default_origin default_node_host default_node_user default_active_llm
  default_origin=$(read_env_value ALLOWED_ORIGINS)
  default_node_host=$(read_env_value AEGIS_NODE_HOST)
  default_node_user=$(read_env_value AEGIS_NODE_USERNAME)
  default_active_llm=$(read_env_value ACTIVE_LLM)

  default_origin=${default_origin:-https://$(hostname -f 2>/dev/null || hostname)}
  default_node_host=${default_node_host:-127.0.0.1}
  default_node_user=${default_node_user:-$AEGIS_USER}
  default_active_llm=${default_active_llm:-deterministic}

  local public_origin node_host node_user active_llm jwt_secret admin_password analyst_password admin_hash analyst_hash
  local allow_destructive='false' claude_key='' openai_key=''

  public_origin=$(prompt_default "Public HTTPS origin for the UI" "$default_origin")
  node_host=$(prompt_default "Node host to inspect/remediate" "$default_node_host")
  node_user=$(prompt_default "Node SSH username" "$default_node_user")
  active_llm=$(prompt_default "LLM mode (deterministic, claude, openai)" "$default_active_llm")
  active_llm=$(printf "%s" "$active_llm" | tr '[:upper:]' '[:lower:]')

  case "$active_llm" in
    deterministic) ;;
    claude)
      claude_key=$(prompt_secret "Claude API key")
      ;;
    openai)
      openai_key=$(prompt_secret "OpenAI API key")
      ;;
    *)
      fail "Unsupported ACTIVE_LLM value: $active_llm"
      ;;
  esac

  say "Generating JWT secret and password hashes"
  jwt_secret=$(generate_secret)

  while :; do
    admin_password=$(prompt_secret "Admin password")
    [ -n "$admin_password" ] && break
    warn "Admin password cannot be empty."
  done
  while :; do
    analyst_password=$(prompt_secret "Analyst password")
    [ -n "$analyst_password" ] && break
    warn "Analyst password cannot be empty."
  done

  admin_hash=$(bcrypt_hash "$admin_password")
  analyst_hash=$(bcrypt_hash "$analyst_password")

  local tmp_env
  tmp_env=$(mktemp)
  cp "$ENV_TEMPLATE" "$tmp_env"

  TMP_ENV="$tmp_env" \
  ACTIVE_LLM_VALUE="$active_llm" \
  CLAUDE_KEY_VALUE="$claude_key" \
  OPENAI_KEY_VALUE="$openai_key" \
  JWT_SECRET_VALUE="$jwt_secret" \
  ADMIN_HASH_VALUE="$admin_hash" \
  ANALYST_HASH_VALUE="$analyst_hash" \
  ALLOW_DESTRUCTIVE_VALUE="$allow_destructive" \
  ALLOWED_ORIGINS_VALUE="$public_origin" \
  NODE_HOST_VALUE="$node_host" \
  NODE_USER_VALUE="$node_user" \
  python3 - <<'PY'
from pathlib import Path
import os

path = Path(os.environ["TMP_ENV"])
text = path.read_text()
replacements = {
    "ACTIVE_LLM": os.environ["ACTIVE_LLM_VALUE"],
    "CLAUDE_API_KEY": os.environ["CLAUDE_KEY_VALUE"],
    "OPENAI_API_KEY": os.environ["OPENAI_KEY_VALUE"],
    "JWT_SECRET": os.environ["JWT_SECRET_VALUE"],
    "ADMIN_HASH": os.environ["ADMIN_HASH_VALUE"],
    "ANALYST_HASH": os.environ["ANALYST_HASH_VALUE"],
    "ALLOW_DESTRUCTIVE_REMEDIATION": os.environ["ALLOW_DESTRUCTIVE_VALUE"],
    "ALLOWED_ORIGINS": os.environ["ALLOWED_ORIGINS_VALUE"],
    "AEGIS_NODE_HOST": os.environ["NODE_HOST_VALUE"],
    "AEGIS_NODE_USERNAME": os.environ["NODE_USER_VALUE"],
}
lines = []
for line in text.splitlines():
    if "=" not in line or line.lstrip().startswith("#"):
        lines.append(line)
        continue
    key, value = line.split("=", 1)
    lines.append(f"{key}={replacements.get(key, value)}")
path.write_text("\n".join(lines) + "\n")
PY

  run_as_root mkdir -p /etc/aegis-gpu
  if [ -f "$ENV_PATH" ]; then
    local backup_path
    backup_path="${ENV_PATH}.bak.$(date +%Y%m%d%H%M%S)"
    run_as_root cp "$ENV_PATH" "$backup_path"
    printf "Backed up existing env file to %s\n" "$backup_path"
  fi
  run_as_root install -m 640 "$tmp_env" "$ENV_PATH"
  if getent group "$AEGIS_USER" >/dev/null 2>&1; then
    run_as_root chown root:"$AEGIS_USER" "$ENV_PATH"
  fi
  rm -f "$tmp_env"
  printf "Wrote %s\n" "$ENV_PATH"
}

preflight() {
  say "Running preflight checks"
  need_cmd awk
  need_cmd python3
  need_cmd nginx
  need_cmd systemctl
  ensure_python_packages
  ensure_aegis_user
  ensure_tls_assets
  write_env_file
}

deploy_now() {
  say "Running deploy helper"
  run_as_root bash "$ROOT/scripts/deploy.sh"
}

main() {
  preflight
  if confirm "Run deployment now?" Y; then
    deploy_now
    local primary_origin
    primary_origin=$(read_env_value ALLOWED_ORIGINS | cut -d, -f1)
    printf "\nBootstrap complete. Test with: %s/\n" "$primary_origin"
  else
    printf "\nBootstrap complete. Deploy later with: sudo bash %s/scripts/deploy.sh\n" "$ROOT"
  fi
}

main "$@"
