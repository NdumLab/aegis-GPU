#!/bin/bash
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

CERT_PATH=${AEGIS_TLS_CERT:-/etc/ssl/certs/aegis-gpu.crt}
KEY_PATH=${AEGIS_TLS_KEY:-/etc/ssl/private/aegis-gpu.key}
DAYS=${AEGIS_TLS_DAYS:-730}

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2
  exit 1
fi

add_unique() {
  local value=$1
  shift
  local existing
  for existing in "$@"; do
    if [ "${existing}" = "${value}" ]; then
      return 1
    fi
  done
  return 0
}

dns_names=()
for name in "$(hostname -s 2>/dev/null || true)" "$(hostname -f 2>/dev/null || true)" localhost; do
  if [ -n "${name}" ] && add_unique "${name}" "${dns_names[@]}"; then
    dns_names+=("${name}")
  fi
done

ip_addresses=(127.0.0.1)
while read -r ip_addr; do
  if [ -n "${ip_addr}" ] && add_unique "${ip_addr}" "${ip_addresses[@]}"; then
    ip_addresses+=("${ip_addr}")
  fi
done < <(ip -o -4 addr show scope global up | awk '{ split($4, addr, "/"); print addr[1] }')

cert_sans=""
if [ -f "${CERT_PATH}" ]; then
  cert_sans=$(openssl x509 -in "${CERT_PATH}" -noout -ext subjectAltName 2>/dev/null || true)
fi

needs_cert=0
if [ ! -f "${CERT_PATH}" ] || [ ! -f "${KEY_PATH}" ]; then
  needs_cert=1
fi

for name in "${dns_names[@]}"; do
  if ! grep -Fq "DNS:${name}" <<<"${cert_sans}"; then
    needs_cert=1
  fi
done

for ip_addr in "${ip_addresses[@]}"; do
  if ! grep -Fq "IP Address:${ip_addr}" <<<"${cert_sans}"; then
    needs_cert=1
  fi
done

if [ "${needs_cert}" -eq 0 ]; then
  echo "TLS certificate already covers current host addresses"
  exit 0
fi

san_entries=()
for name in "${dns_names[@]}"; do
  san_entries+=("DNS:${name}")
done
for ip_addr in "${ip_addresses[@]}"; do
  san_entries+=("IP:${ip_addr}")
done
san_csv=$(IFS=,; printf '%s' "${san_entries[*]}")

if [ "${DRY_RUN}" -eq 1 ]; then
  printf '[dry-run] generate TLS certificate %s with SANs: %s\n' "${CERT_PATH}" "${san_csv}"
  printf '[dry-run] write private key %s\n' "${KEY_PATH}"
  exit 0
fi

tmp_key=$(mktemp)
tmp_crt=$(mktemp)
cleanup() {
  rm -f "${tmp_key}" "${tmp_crt}"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -sha256 -days "${DAYS}" -nodes \
  -keyout "${tmp_key}" \
  -out "${tmp_crt}" \
  -subj "/C=US/ST=Infrastructure/L=Datacenter/O=AegisGPU/OU=Platform/CN=${dns_names[0]}" \
  -addext "subjectAltName=${san_csv}"

install -o root -g root -m 644 "${tmp_crt}" "${CERT_PATH}"
install -o root -g root -m 600 "${tmp_key}" "${KEY_PATH}"
echo "generated TLS certificate with SANs: ${san_csv}"
