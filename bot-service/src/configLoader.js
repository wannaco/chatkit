import axios from 'axios';

const PB_URL = process.env.PB_URL || 'http://localhost:8090';
const PB_SERVICE_TOKEN = process.env.PB_SERVICE_TOKEN || '';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';

const cache = new Map();
const CACHE_TTL = 60_000;

let authToken = PB_SERVICE_TOKEN;
let authTokenTs = PB_SERVICE_TOKEN ? Infinity : 0;
const AUTH_TTL = 30 * 60_000;

async function getAuthToken() {
  if (authToken && Date.now() - authTokenTs < AUTH_TTL) return authToken;
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) return authToken;
  const resp = await axios.post(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    identity: PB_ADMIN_EMAIL,
    password: PB_ADMIN_PASSWORD
  });
  authToken = resp.data?.token || '';
  authTokenTs = Date.now();
  return authToken;
}

export async function getConfig(chatwootInboxId, channel) {
  const cacheKey = `${chatwootInboxId}:${channel}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.config;
  }

  const token = await getAuthToken();
  const filter = encodeURIComponent(`chatwoot_inbox_id=${chatwootInboxId}`);
  const url = `${PB_URL}/api/collections/inboxes/records?filter=${filter}`;
  const resp = await axios.get(url, {
    headers: token ? { Authorization: token } : {}
  });

  const records = resp.data?.items || [];
  if (records.length === 0) {
    throw new Error(`No inbox config found for chatwoot_inbox_id=${chatwootInboxId}`);
  }

  const record = records[0];
  const configJson = typeof record.config === 'string' ? JSON.parse(record.config) : (record.config || {});

  const settings = await getSettings();

  const config = {
    inbox: {
      id: record.chatwoot_inbox_id,
      ...configJson
    },
    CHATWOOT_BASE_URL: settings?.chatwoot_base_url || '',
    CHATWOOT_API_TOKEN: settings?.chatwoot_api_token || '',
    CHATWOOT_ACCOUNT_ID: settings?.chatwoot_account_id || '',
    AGENT_REQUEST_KEYWORDS: configJson.AGENT_REQUEST_KEYWORDS || [],
    HANDOFF_MESSAGE: configJson.HANDOFF_MESSAGE || 'Connecting you to an agent...',
    AI_ASSISTANT_REQUEST_KEYWORDS: configJson.AI_ASSISTANT_REQUEST_KEYWORDS || [],
    AI_ASSISTANT_OFF_KEYWORDS: configJson.AI_ASSISTANT_OFF_KEYWORDS || []
  };

  cache.set(cacheKey, { config, ts: Date.now() });
  return config;
}

export async function getSettings() {
  const token = await getAuthToken();
  const url = `${PB_URL}/api/collections/settings/records`;
  const resp = await axios.get(url, {
    headers: token ? { Authorization: token } : {}
  });
  const records = resp.data?.items || [];
  if (records.length === 0) return null;
  const r = records[0];
  return {
    chatwoot_base_url: r.chatwoot_base_url,
    chatwoot_api_token: r.chatwoot_api_token,
    chatwoot_account_id: r.chatwoot_account_id
  };
}

export function clearCache() {
  cache.clear();
}
