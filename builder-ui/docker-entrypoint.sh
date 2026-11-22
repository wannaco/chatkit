#!/bin/sh
# Generate config.json from environment variables at container startup, so the
# same image runs on any domain without a rebuild.
#
# Leave PB_URL_BROWSER / BOT_SERVICE_URL_BROWSER empty (the default) for the
# normal single-domain setup: the app then talks to its own origin, and this
# container's nginx proxies /api, /_ and /webhook to pocketbase and bot-service.
# Set them only if you expose PocketBase or bot-service on separate domains.

PB_URL_BROWSER="${PB_URL_BROWSER:-}"
BOT_SERVICE_URL_BROWSER="${BOT_SERVICE_URL_BROWSER:-}"

cat > /usr/share/nginx/html/config.json <<EOF
{
  "PB_URL": "${PB_URL_BROWSER}",
  "BOT_SERVICE_URL": "${BOT_SERVICE_URL_BROWSER}"
}
EOF

echo "config.json generated:"
cat /usr/share/nginx/html/config.json
