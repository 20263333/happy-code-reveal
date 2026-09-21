#!/usr/bin/env bash
# Safely checks the VPS AI configuration without printing secret values.
set -euo pipefail

ENV_FILE="/root/binosoz.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

KEY="${LOVABLE_API_KEY:-${LOVABLE_AI_GATEWAY_KEY:-}}"
BODY='{"model":"google/gemini-3.8-flash","messages":[{"role":"user","content":"Return only this JSON: {\"ok\":true}"}],"response_format":{"type":"json_object"}}'
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

if [[ -n "$KEY" ]]; then
  URL='https://ai.gateway.lovable.dev/v1/chat/completions'
  MODE="Lovable AI Gateway (direct key)"
  AUTH_HEADERS=(-H "Lovable-API-Key: $KEY" -H 'X-Lovable-AIG-SDK: fetch')
elif [[ -n "${AI_PROXY_URL:-}" && -n "${AI_PROXY_SECRET:-}" ]]; then
  URL="$AI_PROXY_URL"
  MODE="Lovable AI Proxy ($AI_PROXY_URL)"
  AUTH_HEADERS=(-H "X-AI-Proxy-Secret: $AI_PROXY_SECRET")
elif [[ -n "${OPENAI_API_KEY:-}" ]]; then
  URL='https://api.openai.com/v1/chat/completions'
  MODE="OpenAI (personal key)"
  AUTH_HEADERS=(-H "Authorization: Bearer $OPENAI_API_KEY")
  BODY='{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Return only this JSON: {\"ok\":true}"}],"response_format":{"type":"json_object"}}'
else
  echo "ERROR: no AI configuration found in $ENV_FILE"
  echo "Set AI_PROXY_URL + AI_PROXY_SECRET (recommended) or LOVABLE_API_KEY or OPENAI_API_KEY."
  exit 2
fi

echo "Mode: $MODE"

STATUS=$(curl -sS -o "$TMP_FILE" -w '%{http_code}' \
  "$URL" \
  -H 'Content-Type: application/json' \
  "${AUTH_HEADERS[@]}" \
  --data "$BODY")

if [[ "$STATUS" == "200" ]]; then
  echo "OK: AI is reachable and the passport OCR model is available."
  exit 0
fi

echo "ERROR: AI endpoint returned HTTP $STATUS"
python3 - "$TMP_FILE" <<'PY'
import json, sys
try:
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    message = payload.get("error", {}).get("message") or payload.get("message") or "Unknown gateway error"
    print(message)
except Exception:
    print("The endpoint returned a non-JSON error response.")
PY
exit 3
