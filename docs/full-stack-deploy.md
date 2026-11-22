# Deploying Chatwoot + ChatKit together

For a server that runs **everything**: Chatwoot (Rails, Sidekiq, Postgres,
Redis) and ChatKit, with automatic HTTPS from a bundled Caddy.

Already have Chatwoot? Use [standalone-deploy.md](standalone-deploy.md) instead.

## What you need

- A Linux server with Docker and the Compose plugin. Chatwoot wants at least
  **4 GB RAM** (2 GB with swap works for light use).
- Ports 80 and 443 free.
- Two domains with A records pointing at the server:
  - `chat.example.com` → Chatwoot (agents, website widget, API)
  - `chatkit.example.com` → ChatKit builder and bot webhooks
- An SMTP account if you want Chatwoot's password reset and agent invitation emails.

## 1. Configure

```bash
git clone https://github.com/wannaco/chatkit.git
cd chatkit/deploy
cp .env.full.example .env
```

Replace every `CHANGE_ME` in `.env`:

```bash
openssl rand -hex 64   # SECRET_KEY_BASE
openssl rand -hex 24   # POSTGRES_PASSWORD, WEBHOOK_SECRET
```

Also set `CHATWOOT_DOMAIN`, `DOMAIN`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`
and the SMTP values. For predictable upgrades, pin `CHATWOOT_VERSION` to a
[Chatwoot release](https://github.com/chatwoot/chatwoot/releases) instead of `latest`.

## 2. Start

```bash
docker compose -f docker-compose.full.yml up -d
docker compose -f docker-compose.full.yml logs -f chatwoot-migrate   # first run: wait for it to exit
```

`chatwoot-migrate` creates or upgrades the Chatwoot database and exits. Rails and
Sidekiq start after it finishes. The first start takes a few minutes.

## 3. Set up Chatwoot

1. Open `https://chat.example.com` and create the first (super-admin) account.
2. Create the inbox(es) you need: Website, WhatsApp, Telegram.
3. **Profile settings → Access Token**: copy it.
4. Note the account ID: the number in `/app/accounts/<id>/…`.

## 4. Set up ChatKit

Continue with [standalone-deploy.md, step 4](standalone-deploy.md#4-connect-chatwoot):
log in at `https://chatkit.example.com`, enter the Chatwoot URL
(`https://chat.example.com`), account ID and token in **Settings**, then build
a menu and assign a bot to each inbox.

## Operating it

Use `-f docker-compose.full.yml` with every command, or put
`COMPOSE_FILE=docker-compose.full.yml` in your shell profile.

**Update:**

```bash
git pull
docker compose -f docker-compose.full.yml pull
docker compose -f docker-compose.full.yml up -d    # chatwoot-migrate runs the new migrations first
```

Read Chatwoot's release notes before moving to a new major version.

**Backup** (Chatwoot database + ChatKit data):

```bash
COMPOSE_FILE=docker-compose.full.yml ./backup.sh
```

Uploaded attachments live in the `chatwoot_storage` volume. Include it in your
server backups, or configure Chatwoot to use S3-compatible storage.

**Restore the Chatwoot database:**

```bash
docker compose -f docker-compose.full.yml stop chatwoot-rails chatwoot-sidekiq
gunzip -c backups/chatwoot_<date>.sql.gz | \
  docker compose -f docker-compose.full.yml exec -T chatwoot-postgres psql -U postgres chatwoot_production
docker compose -f docker-compose.full.yml up -d
```

Restore into an empty database (a fresh `chatwoot_postgres` volume), before
`chatwoot-migrate` has run. To restore ChatKit's data, see
[standalone-deploy.md](standalone-deploy.md#backup--restore).
