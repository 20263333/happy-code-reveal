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

# Also read /var/www/binosoz/.env if present
if [[ -f "/var/www/binosoz/.env" ]]; then
  while IFS='=' read -r key val || [[ -n "$key" ]]; do
    key="$(echo "$key" | sed -e "s/^export //" -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//")"
    val="$(echo "$val" | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" -e "s/^['\"]//" -e "s/['\"]$//")"
    if [[ "$key" == "GEMINI_API_KEY" || "$key" == "AI_PROVIDER" || "$key" == "GEMINI_OCR_MODEL" || "$key" == "OPENAI_API_KEY" ]]; then
      export "$key"="$val"
    fi
  done < "/var/www/binosoz/.env" 2>/dev/null || true
fi

KEY="${LOVABLE_API_KEY:-${LOVABLE_AI_GATEWAY_KEY:-}}"
GEMINI_KEY="${GEMINI_API_KEY:-${GOOGLE_API_KEY:-}}"
FORCED="${AI_PROVIDER:-}"
FORCED="${FORCED,,}"
TARGET="${1:-ocr}"
if [[ "$TARGET" != "ocr" && "$TARGET" != "chat" ]]; then
  echo "Usage: bash scripts/check-ai-vps.sh [ocr|chat]"
  exit 2
fi
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

if [[ -n "$GEMINI_KEY" && ( "$FORCED" == "gemini" || "$FORCED" == "google" || ( "$FORCED" != "openai" && -z "$KEY" ) ) ]]; then
  URL='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
  MODE="Google Gemini (personal key)"
  AUTH_HEADERS=(-H "Authorization: Bearer $GEMINI_KEY")
  MODEL="${GEMINI_OCR_MODEL:-gemini-3.8-flash}"
  if [[ "$MODEL" == "gemini-1.5-flash" || "$MODEL" == "gemini-1.5-pro" || "$MODEL" == "gemini-2.5-flash" || "$MODEL" == "gemini-2.0-flash" || "$MODEL" == "gemini-2.0-flash-lite" ]]; then
    MODEL="gemini-3.8-flash"
  fi
elif [[ -n "${OPENAI_API_KEY:-}" && ( "$FORCED" == "openai" || -z "$KEY" ) ]]; then
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
  echo "Set GEMINI_API_KEY, AI_PROXY_URL + AI_PROXY_SECRET, LOVABLE_API_KEY or OPENAI_API_KEY."
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
  echo "OK: selected AI model ($MODEL) responded successfully."
  exit 0
fi

# If Gemini returned 404/not available, try candidate models automatically
if [[ -n "$GEMINI_KEY" && "$MODE" == *"Gemini"* && "$STATUS" == "404" ]]; then
  for ALT in "gemini-3.5-flash" "gemini-3.6-flash" "gemini-3.1-flash-lite"; do
    if [[ "$ALT" != "$MODEL" ]]; then
      echo "Checking alternative Gemini model: $ALT..."
      ALT_BODY=$(python3 - "$ALT" <<'PY'
import json, sys
print(json.dumps({"model": sys.argv[1], "messages": [{"role": "user", "content": "Return only this JSON: {"ok":true}"}], "response_format": {"type": "json_object"}}))
PY
)
      ALT_STATUS=$(curl -sS -o "$TMP_FILE" -w '%{http_code}' "$URL" -H 'Content-Type: application/json' "${AUTH_HEADERS[@]}" --data "$ALT_BODY")
      if [[ "$ALT_STATUS" == "200" ]]; then
        echo "OK: $ALT is working! Set GEMINI_OCR_MODEL="$ALT" in /root/binosoz.env"
        exit 0
      fi
    fi
  done
fi

echo "ERROR: AI endpoint returned HTTP $STATUS"
python3 - "$TMP_FILE" <<'PY'
import json, sys
try:
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    error = payload.get("error", {})
    error = error if isinstance(error, dict) else {}
    msg = str(error.get("message", ""))
    codes = {str(error.get("code", "")), str(error.get("type", "")), str(payload.get("code", ""))}
    quota = {"insufficient_quota", "billing_hard_limit_reached", "billing_not_active", "usage_limit_reached", "credit_balance_exhausted", "credits_exhausted", "insufficient_credits", "payment_required"}
    rate = {"rate_limit_exceeded", "rate_limited", "rate_limit_error", "too_many_requests"}
    if "is not found for API version" in msg or "not found" in msg.lower():
        print(f"Сабаб: Модели интихобшуда дастрас нест ё кӯҳна шудааст ({msg}). Ба модели муосир гузаред.")
    elif codes & quota:
        print("Сабаб: маблағ ё лимити пардохти ҳисоби AI тамом шудааст. Ҳисоби хизматрасонии AI-ро пур кунед; обунаи ChatGPT ба OpenAI API маблағ намедиҳад.")
    elif codes & rate:
        print("Сабаб: маҳдудияти муваққатии шумораи дархостҳо. Каме сабр карда, баъдтар санҷед.")
    else:
        print(f"Ҷавоби сервер: {msg}")
except Exception:
    print("The endpoint returned a non-JSON error response.")
PY
exit 3
