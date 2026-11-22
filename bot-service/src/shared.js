import crypto from 'crypto';
import axios from 'axios';

export const BOT_STATES = {
  INITIAL: 'INITIAL',
  MENU_SENT: 'MENU_SENT'
};

// --- JWT helpers (HS256) for CRM forwarding ---
function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHS256(secret, data) {
  return crypto.createHmac('sha256', String(secret)).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(claims, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(claims));
  const toSign = `${encHeader}.${encPayload}`;
  const sig = signHS256(secret, toSign);
  return `${toSign}.${sig}`;
}

export async function forwardToCrm(url, secret, payload) {
  if (!url) return;
  try {
    if (!payload || typeof payload !== 'object') payload = {};
    if (!payload.timestamp) payload.timestamp = Date.now();

    const isAppsScript = /script\.googleusercontent\.com|script\.google\.com/.test(url);
    let finalUrl = url;
    if (isAppsScript && secret && !/[?&]token=/.test(finalUrl)) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}token=${encodeURIComponent(String(secret))}`;
    }

    const body = JSON.stringify(payload);
    const headers = { 'Content-Type': 'application/json' };

    if (secret) {
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: 'chatkit-forwarder',
        sub: 'crm_webhook',
        iat: now,
        exp: now + 5 * 60
      };
      try {
        headers['Authorization'] = `Bearer ${makeJwt(claims, String(secret))}`;
        headers['X-JWT-Alg'] = 'HS256';
      } catch (_) {}
    }

    await axios.post(finalUrl, body, { headers });
    console.log('(CRM) Forwarded payload to CRM webhook');
  } catch (e) {
    console.error('(CRM) Failed to forward payload:', e?.response?.data || e?.message);
  }
}

export function normalizeKeywordArray(v, defaults = []) {
  try {
    if (!v) return defaults;
    if (Array.isArray(v)) {
      const arr = v.map(s => String(s || '').trim().toLowerCase()).filter(Boolean);
      return arr.length ? arr : defaults;
    }
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) {
          const arr = parsed.map(s => String(s || '').trim().toLowerCase()).filter(Boolean);
          return arr.length ? arr : defaults;
        }
      } catch {}
      const arr = String(v).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      return arr.length ? arr : defaults;
    }
    return defaults;
  } catch (_) { return defaults; }
}

export function indexMenuItems(items) {
  const byKey = new Map();
  const inbound = new Set();
  for (const it of (Array.isArray(items) ? items : [])) {
    if (!it || typeof it.key !== 'string') continue;
    const k = it.key.trim();
    if (!k) continue;
    byKey.set(k, it);
    const children = Array.isArray(it.children_options) ? it.children_options : [];
    for (const ch of children) {
      if (ch && typeof ch.key === 'string' && ch.key.trim()) {
        const ck = ch.key.trim();
        inbound.add(ck);
        byKey.set(ck, ch);
      }
    }
    const parentKey = typeof it._parentKey === 'string' ? it._parentKey.trim() : '';
    if (parentKey && byKey.has(parentKey)) {
      inbound.add(k);
    }
  }
  for (const it of (Array.isArray(items) ? items : [])) {
    if (!it || typeof it.key !== 'string') continue;
    const k = it.key.trim();
    const parentKey = typeof it._parentKey === 'string' ? it._parentKey.trim() : '';
    if (parentKey && byKey.has(parentKey)) {
      inbound.add(k);
    }
  }
  const roots = [];
  for (const k of byKey.keys()) if (!inbound.has(k)) roots.push(k);
  return { byKey, roots };
}

export function currentOptionsForPath(items, path) {
  const { byKey, roots } = indexMenuItems(items);
  const stack = Array.isArray(path) ? path : [];
  if (stack.length === 0) {
    const keys = roots.length > 0 ? roots : Array.from(byKey.keys());
    return keys.map(k => ({ key: k, label: k }));
  }
  const curKey = stack[stack.length - 1];
  const cur = byKey.get(curKey);
  if (!cur) return [];
  const children = Array.isArray(cur.children_options) ? cur.children_options : [];
  return children.map(ch => ({ key: ch.key, label: ch.label || ch.key })).filter(o => !!o.key);
}

export function getConversationStateFromAttributes(customAttributes) {
  const attributes = customAttributes || {};
  const currentState = attributes['bot_context'] || BOT_STATES.INITIAL;
  return { currentState };
}

export function summarizeSubmittedValues(submitted_values) {
  if (!Array.isArray(submitted_values) || submitted_values.length === 0) return 'No data captured.';
  const lines = ['📋 Submitted Form Data:'];
  for (const sv of submitted_values) {
    const name = sv.name || sv.title || 'Field';
    const val = sv.value || sv.answer || '';
    lines.push(`• ${name}: ${val}`);
  }
  return lines.join('\n');
}

export function buildMenuMessage(header, options, pathPrefix = '', backLabel = '', homeLabel = '') {
  if (!options || options.length === 0) return null;
  const prefix = pathPrefix || '';
  const items = options.map(o => ({ title: o.label, value: prefix ? `${prefix}>${o.key}` : o.key }));
  if (prefix) {
    if (homeLabel) items.push({ title: homeLabel, value: '__home__' });
    if (backLabel) items.push({ title: backLabel, value: '__back__' });
  }
  return {
    content: header,
    content_type: 'input_select',
    content_attributes: { items }
  };
}

export function buildMenuTextLines(header, options, backKeywords, homeKeywords, backHomeHint) {
  const lines = [];
  if (header) lines.push(header);
  options.forEach((o, idx) => {
    lines.push(`${idx + 1}. ${o.label}`);
  });
  const backLabel = (Array.isArray(backKeywords) && backKeywords[0]) || '';
  const homeLabel = (Array.isArray(homeKeywords) && homeKeywords[0]) || '';
  if (options.length > 0) {
    const rawTemplate = typeof backHomeHint === 'string' ? backHomeHint.trim() : '';
    const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const fallbackBack = backLabel || 'back';
    const fallbackHome = homeLabel || 'home';

    if (rawTemplate) {
      const backCap = cap(backLabel) || cap(fallbackBack);
      const homeCap = cap(homeLabel) || cap(fallbackHome);
      let hint = rawTemplate;
      hint = hint.replace(/{back}/gi, backCap);
      hint = hint.replace(/{home}/gi, homeCap);
      lines.push('', hint);
    } else if (backLabel || homeLabel) {
      const parts = [];
      if (backLabel) parts.push(`"${cap(backLabel)}" to go back`);
      if (homeLabel) parts.push(`"${cap(homeLabel)}" to return to the main menu`);
      if (parts.length) {
        const hint = parts.length === 2 ? `${parts[0]} or ${parts[1]}.` : `${parts[0]}.`;
        lines.push('', `You can also send ${hint}`);
      }
    }
  }
  return lines;
}

export function renderQuestionText(field, idx) {
  const label = field.label || field.name || `Field ${idx + 1}`;
  const type = (field.type || 'text').toLowerCase();
  if (type === 'select') {
    const opts = Array.isArray(field.options) ? field.options : [];
    const lines = [label + ':', ...opts.map((o, i) => `${i + 1}. ${o.label || o.value || 'Option'}`)];
    return lines.join('\n');
  }
  if (['image','photo','picture','file','document','doc','pdf','audio','voice','video','media','attachment'].includes(type)) {
    const typeHint = (type === 'photo' || type === 'picture') ? 'image' : (type === 'doc' ? 'document' : type);
    return `${label} (please send a ${typeHint}):`;
  }
  return `${label}:`;
}

export function normalizeSelectAnswer(field, text) {
  const opts = Array.isArray(field.options) ? field.options : [];
  const trimmed = (text || '').trim();
  if (/^\d+$/.test(trimmed)) {
    const i = parseInt(trimmed, 10) - 1;
    if (i >= 0 && i < opts.length) return opts[i].value || opts[i].label;
  }
  const lower = trimmed.toLowerCase();
  const found = opts.find(o => (o.label || '').toLowerCase() === lower || (o.value || '').toLowerCase() === lower);
  if (found) return found.value || found.label;
  return null;
}

export function validateAnswer(field, msg, stripHtml) {
  const type = (field.type || 'text').toLowerCase();
  const atts = Array.isArray(msg?.attachments) ? msg.attachments : [];
  const att = atts[0];
  if (att) {
    const url = att.data_url || att.file_url || att.download_url || att.thumb_url || '';
    if (url) return { ok: true, value: url, attachment: true };
    return { ok: false, hint: 'Attachment received, but I could not read it. Please resend the file.' };
  }
  const rawValue = (msg?.content || '').trim();
  const value = stripHtml ? rawValue.replace(/<[^>]*>/g, '').trim() : rawValue;
  if (type === 'email') {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return ok ? { ok: true, value } : { ok: false, hint: 'Please enter a valid email.' };
  }
  if (type === 'number') {
    const ok = /^[-+]?\d+(\.\d+)?$/.test(value);
    return ok ? { ok: true, value } : { ok: false, hint: 'Please enter a valid number.' };
  }
  if (type === 'select') {
    const nv = normalizeSelectAnswer(field, value);
    return nv ? { ok: true, value: nv } : { ok: false, hint: 'Please reply with the number or name of an option.' };
  }
  return value ? { ok: true, value } : { ok: false, hint: 'Please enter a response.' };
}
