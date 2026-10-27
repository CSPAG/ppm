#!/bin/sh
# DNS bei Infomaniak aus den OpenTofu-Ausgaben abgleichen (Ablauf: tofu apply → dns.sh --dry-run → dns.sh apply → Deploy).
#
#   infra/dns/dns.sh --dry-run      Abweichungen zeigen, nichts ändern (Exit 2 = Abweichungen)
#   infra/dns/dns.sh apply          Abweichungen beheben
#
# Soll-Liste: `tofu output -json dns` in infra/hetzner (nach tofu init, mit S3-Zugang und TF_VAR_state_passphrase) oder
# eine Datei in DNS_INPUT. Verwaltet nur Einträge unter den Namen in DNS_ONLY (Standard «ppm»); eine Soll-Liste
# mit anderen Namen bricht ab, bevor die API gefragt wird. Alle anderen Einträge der Zone (z. B. identity) bleiben
# unberührt. Token: INFOMANIAK_API_TOKEN aus der Umgebung (Rechte nur «dns», nie ausgegeben). Logik: infra/dns/dns.ts.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
: "${INFOMANIAK_API_TOKEN:?INFOMANIAK_API_TOKEN fehlt}"

case "${1:---dry-run}" in
  --dry-run|plan) mode=plan ;;
  apply) mode=apply ;;
  *) echo "Aufruf: dns.sh --dry-run | apply" >&2; exit 64 ;;
esac

desired="$(mktemp)"; trap 'rm -f "$desired"' EXIT INT TERM
if [ -n "${DNS_INPUT:-}" ]; then cp "$DNS_INPUT" "$desired"; else (cd "$here/../hetzner" && tofu output -json dns) > "$desired"; fi
node "$here/dns.ts" "$mode" --input "$desired" --only "${DNS_ONLY:-ppm}"
