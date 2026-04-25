#!/usr/bin/env bash
# Local dev server for COG Viewer.
# Binds to 0.0.0.0 so other devices on the LAN can hit it too.
#
# Usage:
#   ./dev.sh              # port 5503
#   ./dev.sh 8080         # custom port
#   PORT=8080 ./dev.sh    # via env

set -euo pipefail

PORT="${1:-${PORT:-5503}}"
HOST="0.0.0.0"

# ── styling ─────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
  CYAN=$'\033[36m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; GRAY=$'\033[90m'
else
  BOLD=''; DIM=''; RESET=''; CYAN=''; GREEN=''; YELLOW=''; RED=''; GRAY=''
fi

err() { printf "  ${RED}✗${RESET} %s\n" "$*" >&2; }
ok()  { printf "  ${GREEN}✓${RESET} %s\n" "$*"; }
hint(){ printf "  ${DIM}%s${RESET}\n" "$*"; }

# ── sanity ──────────────────────────────────────────────
cd "$(dirname "$0")"

if [ ! -f index.html ]; then
  err "index.html not found in $(pwd)"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  err "python3 not found"
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  err "port $PORT is already in use"
  hint "try: $0 $((PORT + 1))"
  exit 1
fi

# ── detect LAN IPs ─────────────────────────────────────
# Primary: the source IP of the default outbound route — the one your phone
# / other LAN devices can actually reach. Skip Docker bridges (172.x) etc.
PRIMARY_IP=$(ip -4 route get 1.1.1.1 2>/dev/null \
  | awk '{for(i=1;i<=NF;i++)if($i=="src")print $(i+1)}' | head -1 || true)

# Extras: other private IPs in standard home/office ranges (no Docker 172.x).
mapfile -t OTHER_IPS < <(
  hostname -I 2>/dev/null | tr ' ' '\n' \
    | grep -E '^(10\.|192\.168\.)' \
    | grep -v "^${PRIMARY_IP:-_no_match_}$" \
    || true
)

LAN_IPS=()
[ -n "${PRIMARY_IP:-}" ] && LAN_IPS+=("$PRIMARY_IP")
[ ${#OTHER_IPS[@]} -gt 0 ] && LAN_IPS+=("${OTHER_IPS[@]}")

# ── header ──────────────────────────────────────────────
echo
printf "  ${BOLD}COG Viewer${RESET} ${GRAY}· local dev${RESET}\n"
printf "  ${DIM}serving $(pwd) on port ${PORT}${RESET}\n"
echo

# ── URL box ─────────────────────────────────────────────
URLS=()
URLS+=("Local   http://localhost:${PORT}")
for ip in "${LAN_IPS[@]}"; do
  URLS+=("LAN     http://${ip}:${PORT}")
done

MAX=0
for u in "${URLS[@]}"; do (( ${#u} > MAX )) && MAX=${#u}; done
W=$((MAX + 4))

draw_h() { local n=$1; local i; for ((i=0;i<n;i++)); do printf '─'; done; }
printf "  ${CYAN}┌"; draw_h $W; printf "┐${RESET}\n"
first=1
for u in "${URLS[@]}"; do
  pad=$(( W - ${#u} - 2 ))
  if [ $first -eq 1 ]; then
    printf "  ${CYAN}│${RESET}  ${BOLD}%s${RESET}%*s${CYAN}│${RESET}\n" "$u" "$pad" ""
    first=0
  else
    printf "  ${CYAN}│${RESET}  %s%*s${CYAN}│${RESET}\n" "$u" "$pad" ""
  fi
done
printf "  ${CYAN}└"; draw_h $W; printf "┘${RESET}\n"

# ── QR for mobile ───────────────────────────────────────
if [ ${#LAN_IPS[@]} -gt 0 ]; then
  if command -v qrencode >/dev/null 2>&1; then
    echo
    hint "scan from your phone (same Wi-Fi):"
    qrencode -t ANSIUTF8 -m 1 "http://${LAN_IPS[0]}:${PORT}" | sed 's/^/  /'
  else
    echo
    hint "tip: \`sudo apt install qrencode\` to show a QR code for mobile testing"
  fi
fi

echo
ok    "ready"
hint  "Ctrl-C to stop"
printf "  ${GRAY}────────────── request log ──────────────${RESET}\n"

# ── trap Ctrl-C, start server ─────────────────────────
trap 'printf "\n\n  ${DIM}stopped${RESET}\n"; exit 0' INT TERM
exec python3 -u -m http.server "$PORT" --bind "$HOST" 2>&1 \
  | sed -u "s/^/  ${GRAY}/; s/\$/${RESET}/"
