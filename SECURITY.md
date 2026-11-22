# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting form:

**https://github.com/wannaco/chatkit/security/advisories/new**

That opens a private draft advisory only you and the maintainer can see. If you
would rather not use GitHub, email **support@thinkcloud.dev** with the subject
"ChatKit security", and no details until a private channel is agreed.

## Before you paste anything

ChatKit stores a Chatwoot **administrator access token**. When reporting, please
**never include**:

- Chatwoot access tokens, PocketBase auth tokens or superuser passwords
- your `WEBHOOK_SECRET`, or webhook URLs that contain it
- customer messages, contact details or conversation exports from a live instance
- PocketBase backups (`pb_data`): they contain the Chatwoot token

Describe the shape of the problem instead. "The token is returned by endpoint X
without authentication" is as useful as the token itself.

## What is in scope

| In scope | Notes |
|---|---|
| bot-service `/api/*` | runs Chatwoot admin actions with the stored token; must require a builder session |
| bot-service `/webhook/*` | forged events, secret bypass, getting the bot to message arbitrary conversations |
| PocketBase rules and migrations | reading `settings` (the token) or `inboxes` without a session, self-registration |
| Builder UI | XSS through menu content or Chatwoot data, token leakage |
| The container images and compose files | default exposures, published ports, default credentials |

## What is not in scope

- Anything that needs a Chatwoot administrator or the PocketBase superuser to
  already be acting in bad faith: they can do the same through Chatwoot or `/_/`.
- Webhook forgery on an install that leaves `WEBHOOK_SECRET` empty. That is a
  documented trade-off; set the secret.
- Issues in Chatwoot or PocketBase themselves: report those upstream
  ([Chatwoot](https://github.com/chatwoot/chatwoot/security),
  [PocketBase](https://github.com/pocketbase/pocketbase)).
- Scanner output with no demonstrated impact.

## What to expect

**This is a spare-time project with no SLA.** The software comes *as is*,
without warranty, as the license says. In practice:

- Security reports are read first, ahead of features and ordinary bugs.
- You will get an acknowledgement and an honest assessment, including
  "not a vulnerability" when that is the answer.
- Warranted fixes are prioritised, but no date is promised.

**If you need a fix by a date, that is a paid engagement.** See
[Professional services](README.md#professional-services--commercial-licensing).
