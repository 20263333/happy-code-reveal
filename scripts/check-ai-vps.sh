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
FORCED="${AI_PROVIDER:-}"
FORCED="${FORCED,,}"
TARGET="${1:-ocr}"
if [[ "$TARGET" != "ocr" && "$TARGET" != "chat" ]]; then
  echo "Usage: bash scripts/check-ai-vps.sh [ocr|chat]"
  exit 2
fi
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

if [[ -n "${OPENAI_API_KEY:-}" && ( "$FORCED" == "openai" || -z "$KEY" ) ]]; then
  URL='https://api.openai.com/v1/chat/completions'
  MODE="OpenAI (personal key)"
  AUTH_HEADERS=(-H "Authorization: Bearer $OPENAI_API_KEY")
  if [[ "$TARGET" == "chat" ]]; then
    MODEL="${OPENAI_CHAT_MODEL:-${OPENAI_OCR_MODEL_PRO:-gpt-4o}}"
  else
    MODEL="${OPENAI_OCR_MODEL:-gpt-4o-mini}"
  fi
elif [[ -n "$KEY" ]]; then
  URL='https://ai.gateway.lovable.dev/v1/chat/completions'
  MODE="Lovable AI Gateway (direct key)"
  AUTH_HEADERS=(-H "Lovable-API-Key: $KEY" -H 'X-Lovable-AIG-SDK: fetch')
  if [[ "$TARGET" == "chat" ]]; then MODEL='openai/gpt-5.4'; else MODEL='google/gemini-3.8-flash'; fi
elif [[ -n "${AI_PROXY_URL:-}" && -n "${AI_PROXY_SECRET:-}" ]]; then
  URL="$AI_PROXY_URL"
  MODE="Lovable AI Proxy"
  AUTH_HEADERS=(-H "X-AI-Proxy-Secret: $AI_PROXY_SECRET")
  if [[ "$TARGET" == "chat" ]]; then MODEL='openai/gpt-5.4'; else MODEL='google/gemini-3.8-flash'; fi
else
  echo "ERROR: no AI configuration found in $ENV_FILE"
  echo "Set AI_PROXY_URL + AI_PROXY_SECRET (recommended) or LOVABLE_API_KEY or OPENAI_API_KEY."
  exit 2
fi

echo "Mode: $MODE"
echo "Model: $MODEL"
BODY=$(python3 - "$MODEL" <<'PY'
import json, sys
print(json.dumps({"model": sys.argv[1], "messages": [{"role": "user", "content": "Return only this JSON: {\"ok\":true}"}], "response_format": {"type": "json_object"}}))
PY
)

STATUS=$(curl -sS -o "$TMP_FILE" -w '%{http_code}' \
  "$URL" \
  -H 'Content-Type: application/json' \
  "${AUTH_HEADERS[@]}" \
  --data "$BODY")

if [[ "$STATUS" == "200" ]]; then
  echo "OK: selected AI model responded."
  exit 0
fi

echo "ERROR: AI endpoint returned HTTP $STATUS"
python3 - "$TMP_FILE" <<'PY'
import json, sys
try:
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    error = payload.get("error", {})
    error = error if isinstance(error, dict) else {}
    codes = {str(error.get("code", "")), str(error.get("type", "")), str(payload.get("code", ""))}
    quota = {"insufficient_quota", "billing_hard_limit_reached", "billing_not_active", "usage_limit_reached", "credit_balance_exhausted", "credits_exhausted", "insufficient_credits", "payment_required"}
    rate = {"rate_limit_exceeded", "rate_limited", "rate_limit_error", "too_many_requests"}
    if codes & quota:
        print("Сабаб: маблағ ё лимити пардохти ҳисоби AI тамом шудааст. Ҳисоби хизматрасонии AI-ро пур кунед; обунаи ChatGPT ба OpenAI API маблағ намедиҳад.")
    elif codes & rate:
        print("Сабаб: маҳдудияти муваққатии шумораи дархостҳо. Каме сабр карда, баъдтар санҷед.")
    else:
        print("Сабаби дақиқ аз ҷавоб муайян нашуд. Ҳолат, маблағ ва лимити ҳисоби AI-ро санҷед.")
except Exception:
    print("The endpoint returned a non-JSON error response.")
PY
exit 3
