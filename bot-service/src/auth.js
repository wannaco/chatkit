// Request authentication for bot-service.
//
// 1. requireBuilderAuth — guards the /api/* routes. Those routes act on Chatwoot
//    with the account's stored API token (create/delete agent bots, reassign
//    inboxes), so they must only be reachable by someone logged in to the
//    builder. The builder sends its PocketBase auth token; we validate it by
//    asking PocketBase to refresh it (works for `users` and `_superusers`).
//
// 2. requireWebhookSecret — optional guard for /webhook/*. Chatwoot agent-bot
//    webhooks are unsigned, so anyone who knows the URL can post forged events.
//    When WEBHOOK_SECRET is set, every webhook URL must carry ?secret=<value>.

import axios from 'axios';
import crypto from 'node:crypto';

const PB_URL = process.env.PB_URL || 'http://localhost:8090';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const AUTH_COLLECTIONS = ['users', '_superusers'];
const CACHE_TTL_MS = 60_000;

const validTokens = new Map(); // token -> expiry timestamp

function extractToken(req) {
  const header = req.get('authorization') || '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

async function isValidPbToken(token) {
  const cached = validTokens.get(token);
  if (cached && cached > Date.now()) return true;

  for (const collection of AUTH_COLLECTIONS) {
    try {
      await axios.post(`${PB_URL}/api/collections/${collection}/auth-refresh`, null, {
        headers: { Authorization: token },
        timeout: 5000
      });
      validTokens.set(token, Date.now() + CACHE_TTL_MS);
      if (validTokens.size > 1000) validTokens.clear();
      return true;
    } catch {
      // try the next auth collection
    }
  }
  return false;
}

export async function requireBuilderAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    if (await isValidPbToken(token)) return next();
  } catch (err) {
    console.error('Auth check failed:', err.message);
  }
  return res.status(401).json({ error: 'Invalid or expired session' });
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function requireWebhookSecret(req, res, next) {
  if (!WEBHOOK_SECRET) return next();
  if (safeEqual(req.query.secret || '', WEBHOOK_SECRET)) return next();
  return res.status(403).json({ error: 'Invalid webhook secret' });
}

// Builds the webhook URL Chatwoot should call, including the secret if set.
export function buildWebhookUrl(baseUrl, channel, inboxId) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/webhook/${channel}`);
  url.searchParams.set('inboxId', String(inboxId));
  if (WEBHOOK_SECRET) url.searchParams.set('secret', WEBHOOK_SECRET);
  return url.toString();
}
