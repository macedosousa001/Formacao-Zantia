#!/usr/bin/env bash
# Configura o webhook do Telegram para apontar para o novo backend.
# Uso:
#   BOT_TOKEN="..." BACKEND_URL="https://zantia-api.onrender.com" ./scripts/set_telegram_webhook.sh

set -euo pipefail

if [[ -z "${BOT_TOKEN:-}" ]]; then
  echo "ERRO: defina BOT_TOKEN" >&2
  exit 1
fi
if [[ -z "${BACKEND_URL:-}" ]]; then
  echo "ERRO: defina BACKEND_URL (ex.: https://zantia-api.onrender.com)" >&2
  exit 1
fi

WEBHOOK="${BACKEND_URL%/}/api/telegram/webhook"
echo "▶ A definir webhook: $WEBHOOK"
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${WEBHOOK}\",\"drop_pending_updates\":true}" | python3 -m json.tool

echo
echo "▶ Estado atual:"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool
