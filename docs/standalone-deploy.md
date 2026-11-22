# Deploying ChatKit next to an existing Chatwoot

This is the normal install: you already run Chatwoot (self-hosted or Chatwoot
Cloud) and want ChatKit's menu bots on top of it. To install Chatwoot as well,
see [full-stack-deploy.md](full-stack-deploy.md).

## What you get

Three containers behind **one domain**:

| Service | Does |
|---|---|
| `builder-ui` | The builder web app, and the single entry point: its nginx routes `/api/collections…`, `/_/` → PocketBase, and `/api/…`, `/webhook/…` → bot-service |
| `bot-service` | Receives Chatwoot agent-bot webhooks and replies through the Chatwoot API |
| `pocketbase` | Stores inbox menus and settings, and handles builder logins |

```
Customer → Chatwoot → webhook → https://chatkit.example.com/webhook/… → bot-service → Chatwoot API (reply)
                                                                            ↑
Builder (browser) → https://chatkit.example.com → builder-ui ─────→ PocketBase (config)
```

## What you need

- A Linux server with Docker and the Compose plugin (`docker compose version`)
- A domain or subdomain for ChatKit, e.g. `chatkit.example.com`
- An administrator login on your Chatwoot account

Chatwoot must be able to reach your ChatKit domain over HTTPS, and ChatKit must
be able to reach Chatwoot.

## 1. Choose a compose file

All files live in `deploy/`:

| File | Use when |
|---|---|
| `docker-compose.yml` | A plain server. Bundled Caddy gets the HTTPS certificate. Needs ports 80 and 443 free. |
| `docker-compose.traefik.yml` | Something already owns 80/443: Dokploy, Traefik, Coolify, an existing nginx… |
| `docker-compose.dev.yml` | Trying it on your own machine. Builds from source, `http://localhost:8080`. |

## 2. Get the files and configure

```bash
git clone https://github.com/wannaco/chatkit.git
cd chatkit/deploy
cp .env.example .env
```

Edit `.env`:

| Variable | Value |
|---|---|
| `DOMAIN` | Your ChatKit domain. Point its A record at the server first. |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | The PocketBase superuser. Created (or its password reset) on every start, and your first builder login. |
| `WEBHOOK_SECRET` | Recommended. `openssl rand -hex 24`. Webhooks without it are refused. |

Your Chatwoot URL and API token are **not** in `.env`. You enter them in the
builder in step 4, and they are stored in PocketBase.

## 3. Start

```bash
docker compose up -d                                   # with bundled Caddy
# or
docker compose -f docker-compose.traefik.yml up -d     # behind your own proxy
```

With `docker-compose.traefik.yml`, route your domain to the **`builder-ui`**
service on **port 80**. In Dokploy: create a Compose app from this repo, set
the compose path to `deploy/docker-compose.traefik.yml`, add the `.env` values
under Environment, and add your domain on service `builder-ui`, port `80`.

Check everything is up:

```bash
docker compose ps
curl -s https://chatkit.example.com/health        # {"status":"ok",…}
```

## 4. Connect Chatwoot

1. Open `https://chatkit.example.com` and log in with `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`.
2. In Chatwoot, open **Profile settings** and copy your **Access Token**. It
   must belong to an **administrator**, because creating agent bots requires it.
3. Note your Chatwoot **account ID**: the number in `/app/accounts/<id>/…`.
4. In the builder, go to **Settings** and enter the Chatwoot base URL, account ID
   and access token. Save.

## 5. Build a menu and attach it to an inbox

1. **Inboxes** lists your Chatwoot inboxes. Click **+ Create Menu** on one, and
   pick the channel type (website, WhatsApp or Telegram).
2. Edit the greeting, menu items, keywords, forms and hand-off message. Save.
3. **Agent Bots**: create a bot (any outgoing URL; it is overwritten in the next step).
4. Back on the inbox, **assign** the bot. ChatKit sets the bot's webhook to
   `https://<DOMAIN>/webhook/<channel>?inboxId=<id>&secret=<WEBHOOK_SECRET>`
   for you.

Prefer the command line? `deploy/provision.sh <inbox_id> <channel>` creates and
assigns the bot through the Chatwoot API. See the header of the script.

## 6. Test

Send a message through the inbox (open the website widget, or message the
WhatsApp number / Telegram bot). The greeting and menu should come back.
Type the hand-off keyword (default `agent`) to reach a human.

## More builder users

The builder login uses PocketBase's `users` collection; public sign-up is
disabled. To add people, open `https://chatkit.example.com/_/`, log in as the
superuser, then **users → New record**.

## Updating

```bash
cd chatkit/deploy
git pull                    # compose / Caddy changes
docker compose up -d        # pull_policy: always fetches new images
```

To pin a version, set `CHATKIT_TAG=<commit sha>` in `.env`. Every image is
also published under the commit it was built from.

## Backup & restore

```bash
cd chatkit/deploy
./backup.sh                                     # → ./backups/pocketbase_<date>.tar.gz
COMPOSE_FILE=docker-compose.traefik.yml ./backup.sh
```

Nightly via cron:

```cron
0 3 * * * cd /opt/chatkit/deploy && ./backup.sh >> /var/log/chatkit-backup.log 2>&1
```

The archive contains the Chatwoot API token, so store it like a password.

Restore:

```bash
docker compose stop pocketbase
docker compose run --rm --no-deps -T --entrypoint sh pocketbase \
  -c 'rm -rf /pb_data/* && tar xzf - -C /pb_data' < backups/pocketbase_<date>.tar.gz
docker compose up -d
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Certificate errors with the bundled Caddy | The A record points here and ports 80/443 are open: `docker compose logs caddy` |
| Builder shows "Chatwoot Not Configured" | Settings saved? The token must be an administrator's. |
| Builder calls return 401 | Your session expired. Log out and in again. |
| Bot doesn't answer | `docker compose logs -f bot-service` while sending a message. Nothing logged means Chatwoot can't reach the webhook. `Invalid webhook secret` means the bot's URL lacks `&secret=`: re-assign the bot from the inbox page. |
| Login fails with the `.env` credentials | `docker compose logs pocketbase` should show "Successfully saved superuser". Restarting `pocketbase` re-applies them. |
