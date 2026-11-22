#!/bin/bash
# Connect a Chatwoot inbox to ChatKit from the command line.
# (The builder does the same thing from the inbox page — this is for scripting.)
#
# Usage: ./provision.sh <chatwoot_inbox_id> <website|whatsapp|telegram>
#
# Required env:
#   CHATWOOT_BASE_URL    https://chat.example.com
#   CHATWOOT_API_TOKEN   an administrator's access token (Profile → Access Token)
#   CHATWOOT_ACCOUNT_ID  the number in /app/accounts/<id>/...
#   BOT_SERVICE_URL      https://chatkit.example.com
# Optional:
#   WEBHOOK_SECRET       same value as in ChatKit's .env
#
# Creates an agent bot whose webhook points at bot-service, then assigns it to
# the inbox. Requires curl and jq.
set -euo pipefail

INBOX_ID=${1:?Usage: provision.sh <chatwoot_inbox_id> <website|whatsapp|telegram>}
CHANNEL=${2:?Usage: provision.sh <chatwoot_inbox_id> <website|whatsapp|telegram>}
case "$CHANNEL" in website|whatsapp|telegram) ;; *) echo "Unknown channel: $CHANNEL" >&2; exit 1 ;; esac

CHATWOOT_URL=${CHATWOOT_BASE_URL:?CHATWOOT_BASE_URL env var required}
API_TOKEN=${CHATWOOT_API_TOKEN:?CHATWOOT_API_TOKEN env var required}
ACCOUNT_ID=${CHATWOOT_ACCOUNT_ID:?CHATWOOT_ACCOUNT_ID env var required}
BOT_URL=${BOT_SERVICE_URL:?BOT_SERVICE_URL env var required}

WEBHOOK_URL="${BOT_URL%/}/webhook/${CHANNEL}?inboxId=${INBOX_ID}"
if [ -n "${WEBHOOK_SECRET:-}" ]; then
  WEBHOOK_URL="${WEBHOOK_URL}&secret=${WEBHOOK_SECRET}"
fi
API="${CHATWOOT_URL%/}/api/v1/accounts/${ACCOUNT_ID}"

echo "Provisioning inbox ${INBOX_ID} (${CHANNEL})..."

# 1. Create the agent bot with its webhook (outgoing) URL
BOT_RESPONSE=$(curl -sS -X POST "${API}/agent_bots" \
  -H "api_access_token: ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg name "ChatKit Bot (inbox ${INBOX_ID})" --arg url "$WEBHOOK_URL" \
        '{name: $name, description: "ChatKit menu bot", outgoing_url: $url}')")

BOT_ID=$(echo "${BOT_RESPONSE}" | jq -r '.id // empty')
if [ -z "${BOT_ID}" ]; then
  echo "Error: failed to create agent bot:" >&2
  echo "${BOT_RESPONSE}" >&2
  exit 1
fi
echo "Created agent bot ${BOT_ID}"

# 2. Assign it to the inbox
curl -sS --fail-with-body -X POST "${API}/inboxes/${INBOX_ID}/set_agent_bot" \
  -H "api_access_token: ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"agent_bot\": ${BOT_ID}}" > /dev/null

echo "Assigned bot ${BOT_ID} to inbox ${INBOX_ID}."
echo "Now create the inbox in the builder (Inboxes → New, Chatwoot inbox ID ${INBOX_ID}) and send a test message."
