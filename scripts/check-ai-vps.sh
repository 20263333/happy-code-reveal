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
if [[ -z "$KEY" ]]; then
  echo "ERROR: LOVABLE_API_KEY is empty in $ENV_FILE"
  echo "The VPS cannot inherit Lovable Cloud secrets automatically."
  exit 2
fi

BODY='{"model":"google/gemini-3.8-flash","messages":[{"role":"user","content":"Return only this JSON: {\"ok\":true}"}],"response_format":{"type":"json_object"}}'
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

STATUS=$(curl -sS -o "$TMP_FILE" -w '%{http_code}' \
  'https://ai.gateway.lovable.dev/v1/chat/completions' \
  -H 'Content-Type: application/json' \
  -H "Lovable-API-Key: $KEY" \
  -H 'X-Lovable-AIG-SDK: fetch' \
  --data "$BODY")

if [[ "$STATUS" == "200" ]]; then
  echo "OK: Lovable AI is reachable and the passport OCR model is available."
  exit 0
fi

echo "ERROR: Lovable AI returned HTTP $STATUS"
python3 - "$TMP_FILE" <<'PY'
import json, sys
try:
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    message = payload.get("error", {}).get("message") or payload.get("message") or "Unknown gateway error"
    print(message)
except Exception:
    print("The gateway returned a non-JSON error response.")
PY
exit 3