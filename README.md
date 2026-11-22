# ChatKit

Menu bots for **Chatwoot**, built visually: greetings, numbered menus and
submenus, keywords, forms, follow-up reminders and hand-off to a human agent,
per inbox, with no code.

ChatKit runs next to your existing Chatwoot (self-hosted or Chatwoot Cloud)
as a Chatwoot *agent bot*. Self-hosted, single-tenant: one install serves one
Chatwoot account.

Built by **[ThinkCloud](https://thinkcloud.dev)**: IT consulting, Chatwoot and
workflow automation, and self-hosted infrastructure.

## Features

- **Visual builder:** menu tree editor with a flow view, per-inbox greeting, menu, keywords, back/home navigation
- **Channels:** Chatwoot Website widget, WhatsApp and Telegram inboxes
- **Forms:** ask a series of questions; answers go to the contact, conversation attributes, a private note and an optional CRM webhook
- **Agent hand-off:** keywords that hand the conversation to a person, with labels and team assignment
- **Follow-ups:** a reminder if the customer goes quiet
- **Lead alerts:** optional instant notification through an [ntfy](https://ntfy.sh) topic
- **Prebuilt images:** `ghcr.io/wannaco/chatkit/*`, nothing to compile

## Quick start (you already have Chatwoot)

You need a server with Docker and a domain pointed at it.

```bash
git clone https://github.com/wannaco/chatkit.git
cd chatkit/deploy
cp .env.example .env        # set DOMAIN, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, WEBHOOK_SECRET
docker compose up -d
```

Then open `https://<DOMAIN>`, log in with `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`,
enter your Chatwoot URL, account ID and an administrator's access token under
**Settings**, build a menu, and assign the bot to an inbox.

**Full guide:** [docs/standalone-deploy.md](docs/standalone-deploy.md)

### Which compose file?

| File | For |
|---|---|
| `deploy/docker-compose.yml` | A plain server. Bundled Caddy gets the HTTPS certificate for you. |
| `deploy/docker-compose.traefik.yml` | Dokploy, Traefik, Coolify, or any existing reverse proxy |
| `deploy/docker-compose.full.yml` | **Installs Chatwoot too** (Rails, Sidekiq, Postgres, Redis). See [docs/full-stack-deploy.md](docs/full-stack-deploy.md). |
| `deploy/docker-compose.dev.yml` | Local evaluation, built from source, `http://localhost:8080` |

## How it works

```
Customer ─▶ Chatwoot ─▶ webhook ─▶ bot-service ─▶ Chatwoot API (reply)
                                       ▲
                                  PocketBase (menus, settings)
                                       ▲
Builder (browser) ─▶ builder-ui ───────┘
```

Three containers behind one domain. `builder-ui`'s nginx is the single entry
point:

| Path | Goes to |
|---|---|
| `/api/collections/…`, `/api/files/…`, `/api/realtime`, `/api/health`, `/_/` | `pocketbase:8090` |
| `/api/…` (other), `/webhook/…`, `/health` | `bot-service:3001` |
| everything else | the builder app (static SvelteKit) |

| Service | Stack | Role |
|---|---|---|
| `builder-ui` | SvelteKit + nginx | builder UI and router |
| `bot-service` | Node + Express | webhook receiver and bot flow, Chatwoot API proxy for the builder |
| `pocketbase` | PocketBase 0.39 | menus and settings, builder logins, migrations |

## Security notes

- bot-service's `/api/*` routes act on Chatwoot with the stored administrator
  token. They require a valid builder (PocketBase) session.
- Public sign-up is disabled. Builder users are added by the superuser at `/_/`.
- Chatwoot does not sign agent-bot webhooks. Set `WEBHOOK_SECRET` so
  bot-service rejects webhook calls that do not carry it.
- PocketBase backups contain the Chatwoot token. Store them like passwords.

Reporting a vulnerability: see [SECURITY.md](SECURITY.md).

## Development

```bash
# bot-service
cd bot-service && npm install
npm test                                     # node --test
PB_URL=http://127.0.0.1:8090 npm start       # http://localhost:3001

# builder-ui
cd builder-ui && npm install && npm run dev  # reads static/config.json (localhost URLs)

# pocketbase: download the v0.39.x binary for your OS, then
./pocketbase superuser upsert admin@example.com <password> --dir=pb_data
./pocketbase serve --dir=pb_data --migrationsDir=pocketbase/migrations
```

Or run the whole stack from source: `cd deploy && docker compose -f docker-compose.dev.yml up --build`.

Images are built and published to GHCR by [GitHub Actions](.github/workflows/build-push.yml)
on every push to `main`, tagged `:latest` and `:<commit sha>`.

```
ghcr.io/wannaco/chatkit/pocketbase
ghcr.io/wannaco/chatkit/bot-service
ghcr.io/wannaco/chatkit/builder-ui
```

## Professional services & commercial licensing

ChatKit is maintained by **[ThinkCloud](https://thinkcloud.dev)**, an IT and
automation consultancy for growing teams, working directly with engineers,
with no sales layers.

- **Chatwoot done for you:** managed Chatwoot + ChatKit hosting, WhatsApp
  Business and Telegram setup, migrations, upgrades and backups
- **Custom bot flows and integrations:** CRM hand-off, lead routing, AI-assisted
  replies, n8n workflows
- **Commercial licensing and support:** hosting ChatKit for your clients,
  bundling it in a product you sell, or a support agreement with response times

Visit **[thinkcloud.dev](https://thinkcloud.dev)** or email **support@thinkcloud.dev**.

## License

**PolyForm Internal Use License 1.0.0.** See [LICENSE](LICENSE): the standard
PolyForm text plus one added section permitting personal use.

**Free for internal use, at any company size.** You may use, modify and
self-host ChatKit for your own organisation's customer conversations,
commercially or not. Small business, enterprise, nonprofit, government, home
lab: all permitted, at no cost and with no registration.

**You may not distribute it.** Without written permission you may not:

- redistribute ChatKit, or a modified version of it, to anyone else
- offer it to third parties as a hosted or managed service, for example
  running it for your agency's clients
- bundle or embed it in a product or service that you sell

**Commercial licensing** covers those cases. See the section above.

### Source-available, not "open source"

The [Open Source Definition](https://opensource.org/osd) forbids restricting
what software may be used for, so a license like this one is *source-available*,
not open source. GitHub will not show an OSI license badge, and some companies'
policies only allow OSI-approved licenses. The trade-off is deliberate: the
source is public so it can be audited, self-hosted and improved, while
commercial rights stay with the copyright holder.

### Third-party components

ChatKit includes PocketBase and a number of npm packages, all under permissive
licenses (MIT, ISC, BSD, 0BSD). Full notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Chatwoot is a separate project (MIT core) that ChatKit talks to over its API.
ChatKit contains no Chatwoot code.

Copyright (c) 2026 ThinkCloud.
