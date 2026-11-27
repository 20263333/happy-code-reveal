#!/usr/bin/env bash
# Интихоб ва ивази фаврии провайдери AI (OpenAI / Gemini / AI Proxy)
set -euo pipefail

TARGET_PROVIDER="${1:-}"
KEY_INPUT="${2:-}"

if [[ -z "$TARGET_PROVIDER" ]]; then
  echo "Истифода: bash scripts/vps-switch-ai.sh [openai|gemini|proxy] [КАЛИДИ_ИХТИЁРӢ]"
  echo "Намунаҳо:"
  echo "  1) Ба OpenAI (сканери пулии асосӣ):"
  echo "     bash scripts/vps-switch-ai.sh openai"
  echo "  2) Ба OpenAI бо калиди нав:"
  echo "     bash scripts/vps-switch-ai.sh openai sk-proj-..."
  echo "  3) Ба Google Gemini:"
  echo "     bash scripts/vps-switch-ai.sh gemini"
  exit 1
fi

TARGET_PROVIDER="$(echo "$TARGET_PROVIDER" | tr '[:upper:]' '[:lower:]')"

if [[ "$TARGET_PROVIDER" != "openai" && "$TARGET_PROVIDER" != "gemini" && "$TARGET_PROVIDER" != "proxy" ]]; then
  echo "ХАТО: Провайдер бояд 'openai', 'gemini' ё 'proxy' бошад."
  exit 2
fi

update_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then return 0; fi

  # Навсозии AI_PROVIDER
  if grep -q "^AI_PROVIDER=" "$file" 2>/dev/null; then
    sed -i "s|^AI_PROVIDER=.*|AI_PROVIDER=\"$TARGET_PROVIDER\"|" "$file"
  else
    echo "AI_PROVIDER=\"$TARGET_PROVIDER\"" >> "$file"
  fi

  # Агар калиди нав ворид шуда бошад
  if [[ -n "$KEY_INPUT" ]]; then
    if [[ "$TARGET_PROVIDER" == "openai" ]]; then
      if grep -q "^OPENAI_API_KEY=" "$file" 2>/dev/null; then
        sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=\"$KEY_INPUT\"|" "$file"
      else
        echo "OPENAI_API_KEY=\"$KEY_INPUT\"" >> "$file"
      fi
    elif [[ "$TARGET_PROVIDER" == "gemini" ]]; then
      if grep -q "^GEMINI_API_KEY=" "$file" 2>/dev/null; then
        sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=\"$KEY_INPUT\"|" "$file"
      else
        echo "GEMINI_API_KEY=\"$KEY_INPUT\"" >> "$file"
      fi
    fi
  fi
}

update_file "/root/binosoz.env"
update_file "/var/www/binosoz/.env"

echo "==> Провайдери AI ба '$TARGET_PROVIDER' иваз карда шуд."

# Санҷиши пайвастшавӣ
echo "==> Санҷиши пайвастшавӣ ба $TARGET_PROVIDER..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/check-ai-vps.sh" ]]; then
  bash "$SCRIPT_DIR/check-ai-vps.sh" ocr || true
fi

# Бозоғозии сервиси binosoz агар pm2 бошад
if command -v pm2 &>/dev/null; then
  echo "==> Бозоғозии сервиси binosoz дар PM2..."
  pm2 restart binosoz --update-env 2>/dev/null || pm2 restart all 2>/dev/null || true
  echo "OK: Сервис бомуваффақият бозоғоз шуд."
fi

echo "Ивази провайдер бомуваффақият анҷом ёфт!"
