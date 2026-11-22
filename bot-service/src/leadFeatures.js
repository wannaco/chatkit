import axios from 'axios';
import { summarizeSubmittedValues } from './shared.js';

// Central helpers for the 4 lead features that replace the CRM webhook:
//   1. Handoff with context (form data follows the lead → agent)
//   2. Form answers → Chatwoot contact enrichment (custom attributes)
//   3. Smart intent routing + tagging (conversation labels from the menu path)
//   4. Instant lead alerts (ntfy)
// Legacy CRM webhook forwarding still works if crmWebhookUrl is configured.

function chatwootHeaders(token) {
  return { api_access_token: token, 'Content-Type': 'application/json' };
}

// Derive a label from the last segment of the menu path (intent).
export function deriveIntentLabels(menuPath) {
  if (!Array.isArray(menuPath) || menuPath.length === 0) return [];
  const last = String(menuPath[menuPath.length - 1] || '').trim();
  if (!last) return [];
  const label = last.slice(0, 40).replace(/[^\w\s-]/g, '').trim();
  return label ? [label] : [];
}

// --- Feature 2: form answers → contact custom attributes + email/phone/name ---
export async function enrichContact({ baseUrl, token, accountId, contactId, answers }) {
  if (!baseUrl || !token || !accountId || !contactId || !Array.isArray(answers) || answers.length === 0) return;
  const url = `${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}`;
  const custom = {};
  let email = null;
  let phone = null;
  let name = null;
  for (const a of answers) {
    const key = String(a.name || a.title || '').trim().toLowerCase();
    const val = a.value ?? a.answer ?? '';
    if (!key || val === '' || val === null || val === undefined) continue;
    if (key.includes('email')) email = val;
    else if (key.includes('phone') || key.includes('tel') || key.includes('mobile')) phone = val;
    else if (key.includes('name') && !name) name = val;
    else custom[`bot_${key}`] = String(val).slice(0, 500);
  }
  const payload = { custom_attributes: custom };
  if (email) payload.email = email;
  if (phone) payload.phone_number = String(phone).replace(/[^\d+]/g, '');
  if (name) payload.name = name;
  try {
    await axios.patch(url, payload, { headers: chatwootHeaders(token) });
    console.log('(Leads) Contact enriched:', contactId, JSON.stringify({ email, phone, name }));
  } catch (e) {
    console.error('(Leads) Contact enrich failed:', e?.response?.data || e?.message);
  }
}

// --- Feature 3: intent labels on the conversation ---
export async function addConversationLabels({ baseUrl, token, accountId, conversationId, labels }) {
  if (!baseUrl || !token || !accountId || !conversationId || !Array.isArray(labels) || labels.length === 0) return;
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`;
  try {
    await axios.post(url, { labels }, { headers: chatwootHeaders(token) });
    console.log('(Leads) Labels added:', labels.join(', '));
  } catch (e) {
    console.error('(Leads) Label add failed:', e?.response?.data || e?.message);
  }
}

// --- Feature 1 helper: private note into the conversation ---
export async function addConversationNote({ baseUrl, token, accountId, conversationId, content }) {
  if (!baseUrl || !token || !accountId || !conversationId || !content) return;
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  try {
    await axios.post(url, { content, message_type: 'outgoing', private: true }, { headers: chatwootHeaders(token) });
    console.log('(Leads) Private note added to conversation', conversationId);
  } catch (e) {
    console.error('(Leads) Note failed:', e?.response?.data || e?.message);
  }
}

export async function setConversationAttributes({ baseUrl, token, accountId, conversationId, attrs }) {
  if (!baseUrl || !token || !accountId || !conversationId || !attrs) return;
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/custom_attributes`;
  try {
    await axios.post(url, { custom_attributes: attrs }, { headers: chatwootHeaders(token) });
    console.log('(Leads) Conversation attrs set:', JSON.stringify(attrs));
  } catch (e) {
    console.error('(Leads) Attr set failed:', e?.response?.data || e?.message);
  }
}

// --- Feature 4: instant lead alert — Chatwoot-native (team mention) ---
// Chatwoot mentions are MARKUP, not free text: (mention://user/<id>/<name>)
// for agents and (mention://team/<id>/<name>) for teams — and the note MUST be
// private for mentions to fire. @all is NOT a valid mention. So we resolve the
// configured team NAME to its ID via GET /api/v1/accounts/{id}/teams, then
// embed the (mention://team/...) markup. No external service needed.

let _teamIdCache = new Map(); // key -> { id, ts }
const TEAM_CACHE_TTL = 5 * 60 * 1000;

async function resolveTeamId({ baseUrl, token, accountId, teamName }) {
  const name = String(teamName || '').trim();
  if (!name) return null;
  const key = `${accountId}:${name.toLowerCase()}`;
  const cached = _teamIdCache.get(key);
  if (cached && Date.now() - cached.ts < TEAM_CACHE_TTL) return cached.id;
  try {
    const resp = await axios.get(`${baseUrl}/api/v1/accounts/${accountId}/teams`, { headers: chatwootHeaders(token) });
    const teams = Array.isArray(resp.data?.payload) ? resp.data.payload : (Array.isArray(resp.data) ? resp.data : []);
    const t = teams.find(x => String(x.name || '').trim().toLowerCase() === name.toLowerCase())
      || teams.find(x => String(x.name || '').toLowerCase().includes(name.toLowerCase()));
    if (t && t.id) {
      _teamIdCache.set(key, { id: t.id, ts: Date.now() });
      return t.id;
    }
    console.warn(`(Leads) Team not found: "${name}" — no mention will be added`);
  } catch (e) {
    console.error('(Leads) Team lookup failed:', e?.response?.data || e?.message);
  }
  return null;
}

export async function sendLeadAlert({ baseUrl, token, accountId, conversationId, title, message, mentionTeam }) {
  if (!baseUrl || !token || !accountId || !conversationId) return;
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  let prefix = `🔔 ${title}`;
  const teamName = String(mentionTeam || '').trim();
  if (teamName) {
    const teamId = await resolveTeamId({ baseUrl, token, accountId, teamName });
    if (teamId) {
      // Chatwoot mentions are MARKDOWN LINKS: [@Name](mention://team/<id>/<url-encoded name>)
      // (see MessageFormatHelper.transform_user_mention_content). The bare
      // (mention://team/...) form renders as plain text — that was the bug.
      const encoded = encodeURIComponent(teamName);
      prefix = `[@${teamName}](mention://team/${teamId}/${encoded}) ${prefix}`;
    }
  }
  const content = `${prefix}\n${message}`;
  try {
    await axios.post(url, { content, message_type: 'outgoing', private: true }, { headers: chatwootHeaders(token) });
    console.log('(Leads) Agent alert posted to conversation', conversationId, `team=${teamName || '(none)'}`);
  } catch (e) {
    console.error('(Leads) Agent alert failed:', e?.response?.data || e?.message);
  }
}

// Called when a form completes — enrichment + labels + alert (+ legacy CRM).
export async function handleFormComplete(ctx, config, chatwoot, opts) {
  const inbox = config?.inbox || {};
  const answers = opts.answers || [];
  const menuPath = opts.menuPath || ctx.menu_path || [];

  if (inbox.enableContactEnrichment !== false) {
    await enrichContact({ ...chatwoot, contactId: opts.contactId, answers });
  }
  if (inbox.enableIntentLabels !== false) {
    const labels = deriveIntentLabels(menuPath);
    await addConversationLabels({ ...chatwoot, conversationId: opts.conversationId, labels });
  }
  if (inbox.enableLeadAlerts !== false) {
    const title = `New lead — ${String(menuPath[menuPath.length - 1] || 'Form').slice(0, 30)}`;
    const custom = typeof inbox.leadAlertMessage === 'string' && inbox.leadAlertMessage.trim()
      ? inbox.leadAlertMessage.trim() : 'New lead submitted — check the conversation';
    const body = `${custom}\n\n${summarizeSubmittedValues(answers)}`;
    await sendLeadAlert({
      ...chatwoot,
      conversationId: opts.conversationId,
      title,
      message: body,
      mentionTeam: inbox.leadAlertTeam
    });
  }
  // Legacy CRM webhook still works if configured.
  if (inbox.crmWebhookUrl) {
    try {
      const { forwardToCrm } = await import('./shared.js');
      await forwardToCrm(inbox.crmWebhookUrl, inbox.crmWebhookSecret, {
        source: opts.channelName,
        account_id: opts.accountId,
        conversation_id: opts.conversationId,
        inbox_id: inbox.id || null,
        submitted_values: answers,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('(Leads) CRM forward error:', e?.response?.data || e?.message);
    }
  }
}

// Called on agent handoff — context note + attrs + labels.
export async function handleHandoff(ctx, config, chatwoot, opts) {
  const inbox = config?.inbox || {};
  const menuPath = opts.menuPath || ctx.menu_path || [];
  const answers = opts.answers || ctx.last_form_answers || [];

  const contextParts = [];
  if (Array.isArray(menuPath) && menuPath.length > 0) {
    contextParts.push(`🧭 Intent: ${menuPath.join(' → ')}`);
  }
  if (Array.isArray(answers) && answers.length > 0) {
    contextParts.push(summarizeSubmittedValues(answers));
  }

  if (inbox.enableHandoffContext !== false) {
    if (contextParts.length > 0) {
      await addConversationNote({
        ...chatwoot,
        conversationId: opts.conversationId,
        content: `🤝 Handoff context\n${contextParts.join('\n')}`
      });
    }
    await setConversationAttributes({
      ...chatwoot,
      conversationId: opts.conversationId,
      attrs: { bot_handed_off: 'true', bot_handoff_ts: Math.floor(Date.now() / 1000) }
    });
  }
  if (inbox.enableIntentLabels !== false) {
    const labels = deriveIntentLabels(menuPath);
    await addConversationLabels({ ...chatwoot, conversationId: opts.conversationId, labels });
  }
}
