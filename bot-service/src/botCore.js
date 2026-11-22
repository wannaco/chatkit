import {
  BOT_STATES,
  normalizeKeywordArray,
  indexMenuItems,
  currentOptionsForPath,
  getConversationStateFromAttributes,
  summarizeSubmittedValues,
  buildMenuMessage,
  buildMenuTextLines,
  renderQuestionText,
  validateAnswer,
  forwardToCrm
} from './shared.js';
import { handleFormComplete, handleHandoff } from './leadFeatures.js';

export async function handleBotFlow(accountId, conversationId, message, customAttributes, config, adapter) {
  const { channelName, logPrefix, supportsInteractive, enforcePendingStatus, sendMessage, updateState, updateStatus, normalizeIncoming } = adapter;

  const chatwoot = {
    baseUrl: config?.CHATWOOT_BASE_URL,
    token: config?.CHATWOOT_API_TOKEN,
    accountId: config?.CHATWOOT_ACCOUNT_ID
  };
  const contactId = message?._contactId || null;

  let ctx = { state: BOT_STATES.INITIAL, menu_path: [], form: null, ai_active: false };
  try {
    const raw = customAttributes?.bot_context;
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') ctx = { ...ctx, ...parsed };
    } else if (typeof raw === 'string' && raw.trim()) {
      ctx.state = raw.trim();
    }
  } catch (_) {}

  console.log(`${logPrefix} DEBUG bot_context raw=${JSON.stringify(customAttributes?.bot_context)} ctx=${JSON.stringify(ctx)}`);

  async function saveCtx(changes) {
    ctx = { ...ctx, ...changes };
    console.log(`${logPrefix} DEBUG saveCtx writing=${JSON.stringify(ctx)}`);
    await updateState(accountId, conversationId, JSON.stringify(ctx));
  }

  const currentState = ctx.state || BOT_STATES.INITIAL;
  const rawContent = message.content?.trim() || '';
  const normalizedContent = normalizeIncoming(rawContent);
  const normalizedMessage = normalizedContent.toLowerCase();

  const _formActive = !!(ctx.form && typeof ctx.form === 'object' && ctx.form.active);

  // --- AI Assistant state management ---
  try {
    const aiOnWords = Array.isArray(config?.AI_ASSISTANT_REQUEST_KEYWORDS) ? config.AI_ASSISTANT_REQUEST_KEYWORDS : [];
    const agentWords = Array.isArray(config?.AGENT_REQUEST_KEYWORDS) ? config.AGENT_REQUEST_KEYWORDS : [];
    const aiOffExtra = Array.isArray(config?.AI_ASSISTANT_OFF_KEYWORDS) ? config.AI_ASSISTANT_OFF_KEYWORDS : [];
    const defaultOff = ['stop', 'exit', 'menu', 'end'];
    const offWords = [...aiOffExtra, ...agentWords, ...defaultOff];
    const hit = (arr) => arr.some((kw) => normalizedMessage?.includes(String(kw || '').toLowerCase()));

    const isActive = !!ctx.ai_active;

    if (hit(offWords) && isActive) {
      await saveCtx({ ai_active: false });
    }

    const turningOn = !_formActive && hit(aiOnWords);
    const nowActive = turningOn || !!ctx.ai_active;

    if (turningOn && !isActive) {
      await saveCtx({ ai_active: true, ai_since: Math.floor(Date.now() / 1000) });
    }

    if (nowActive && !_formActive && config?.inbox?.crmWebhookUrl) {
      await forwardToCrm(config.inbox.crmWebhookUrl, config.inbox.crmWebhookSecret, {
        source: channelName,
        account_id: accountId,
        conversation_id: conversationId,
        inbox_id: config?.inbox?.id || null,
        ai_assistant_active: true,
        message: {
          content: rawContent || '',
          attachments: Array.isArray(message?.attachments) ? message.attachments : []
        },
        timestamp: Date.now()
      });
      return;
    }
  } catch (e) {
    console.error(`${logPrefix} AI assistant forward error:`, e?.response?.data || e?.message);
    return;
  }

  // --- Setup ---
  let nextState = currentState;
  let replyContent = null;
  let triggerHandoff = false;

  const initialGreeting = config?.inbox?.INITIAL_RESPONSE || 'Hello!';
  const items = Array.isArray(config?.inbox?.MENU_ITEMS) ? config.inbox.MENU_ITEMS : [];
  const allItemsByKey = new Map();
  const parentOf = new Map();
  for (const it of items) {
    if (!it || typeof it.key !== 'string') continue;
    const k = it.key.trim();
    if (!k) continue;
    allItemsByKey.set(k, it);
    const children = Array.isArray(it.children_options) ? it.children_options : [];
    for (const ch of children) {
      if (ch && typeof ch.key === 'string' && ch.key.trim()) {
        const ck = ch.key.trim();
        allItemsByKey.set(ck, ch);
        parentOf.set(ck, k);
      }
    }
    const resp = it.response;
    if (resp && typeof resp === 'object' && resp.content_type === 'input_select') {
      const embeddedItems = Array.isArray(resp?.content_attributes?.items) ? resp.content_attributes.items : [];
      for (const ei of embeddedItems) {
        const ek = (typeof ei.value === 'string' ? ei.value : (typeof ei.title === 'string' ? ei.title : null));
        if (ek && ek.trim()) {
          const tk = ek.trim();
          if (!allItemsByKey.has(tk)) {
            allItemsByKey.set(tk, { key: tk, label: ei.title || tk, response: null });
          }
          parentOf.set(tk, k);
        }
      }
    }
  }
  const responses = {};
  for (const it of items) {
    if (it && typeof it.key === 'string' && it.key.trim().length > 0) {
      responses[it.key.trim()] = it.response;
    }
    const children = Array.isArray(it?.children_options) ? it.children_options : [];
    for (const ch of children) {
      if (ch && typeof ch.key === 'string' && ch.key.trim().length > 0) {
        responses[ch.key.trim()] = ch.response;
      }
    }
  }
  for (const it of items) {
    const resp = it?.response;
    if (resp && typeof resp === 'object' && resp.content_type === 'input_select') {
      const embeddedItems = Array.isArray(resp?.content_attributes?.items) ? resp.content_attributes.items : [];
      for (const ei of embeddedItems) {
        const ek = (typeof ei.value === 'string' ? ei.value : (typeof ei.title === 'string' ? ei.title : null));
        if (ek && ek.trim()) {
          const tk = ek.trim();
          const matched = items.find(x => x && typeof x.key === 'string' && x.key.trim() === tk);
          if (matched) {
            if (!responses[tk]) responses[tk] = matched.response;
          } else if (typeof ei.description === 'string' && ei.description.trim()) {
            if (!responses[tk]) responses[tk] = ei.description.trim();
          }
        }
      }
    }
  }
  const menuPrompt = config?.inbox?.MENU_PROMPT || 'Please select an option:';
  const backKeywords = normalizeKeywordArray(config?.inbox?.BACK_KEYWORDS, ['back']);
  const homeKeywords = normalizeKeywordArray(config?.inbox?.HOME_KEYWORDS, ['home', 'menu']);
  const formCompleteMsg = config?.inbox?.FORM_COMPLETE_MESSAGE || 'Thanks — we got your details and will follow up shortly.';
  const formIntroMsg = config?.inbox?.FORM_INTRO_MESSAGE || 'Please share a few details to help us assist you:';
  const attachmentAckMsg = config?.inbox?.ATTACHMENT_ACK_MESSAGE || '';
  const backHomeHint = config?.inbox?.BACK_HOME_HINT;

  let menuPath = Array.isArray(ctx.menu_path) ? ctx.menu_path : [];
  const curOptions = currentOptionsForPath(items, menuPath);

  console.log(`${logPrefix} state=${currentState} incoming="${rawContent}" menuPath=${JSON.stringify(menuPath)} curOptions=${JSON.stringify(curOptions.map(o => o.key))}`);

  const pathPrefix = menuPath.join('>');
  const bLabel0 = (Array.isArray(backKeywords) && backKeywords[0]) || 'Back';
  const hLabel0 = (Array.isArray(homeKeywords) && homeKeywords[0]) || 'Home';
  const menuMessage = supportsInteractive ? buildMenuMessage(menuPrompt, curOptions, pathPrefix, bLabel0, hLabel0) : null;
  const menuTextLines = buildMenuTextLines(menuPrompt, curOptions, backKeywords, homeKeywords, backHomeHint);

  const formSession = (ctx.form && typeof ctx.form === 'object') ? ctx.form : null;
  async function setFormSession(state) {
    await saveCtx({ state: BOT_STATES.MENU_SENT, form: state });
  }

  async function setMenuPath(_accountId, _conversationId, path) {
    await saveCtx({ state: BOT_STATES.MENU_SENT, menu_path: path });
  }

  async function sendMenu(opts, path) {
    if (supportsInteractive) {
      const prefix = (Array.isArray(path) ? path : []).join('>');
      const bLabel = (Array.isArray(backKeywords) && backKeywords[0]) || 'Back';
      const hLabel = (Array.isArray(homeKeywords) && homeKeywords[0]) || 'Home';
      const msg = buildMenuMessage(menuPrompt, opts, prefix, bLabel, hLabel);
      if (msg) {
        await sendMessage(accountId, conversationId, msg.content, { contentType: msg.content_type, contentAttributes: msg.content_attributes });
        return;
      }
    }
    const lines = buildMenuTextLines(menuPrompt, opts, backKeywords, homeKeywords, backHomeHint);
    await sendMessage(accountId, conversationId, lines.join('\n'));
  }

  async function sendResponse(resp, fallbackText, keyForForm) {
    if (typeof resp === 'string') {
      replyContent = resp;
      return;
    }
    if (!resp || typeof resp !== 'object') {
      replyContent = fallbackText || '...';
      return;
    }

    if (resp.content_type === 'article' || resp.content_type === 'cards') {
      await sendMessage(accountId, conversationId, resp.content || fallbackText || menuPrompt, {
        contentType: resp.content_type,
        contentAttributes: resp.content_attributes || {}
      });
      replyContent = null;
    } else if (resp.content_type === 'input_select') {
      await sendMessage(accountId, conversationId, resp.content || fallbackText || menuPrompt, {
        contentType: resp.content_type,
        contentAttributes: resp.content_attributes || {}
      });
      replyContent = null;
    } else if (resp.content_type === 'form') {
      await sendMessage(accountId, conversationId, resp.content || fallbackText || menuPrompt, {
        contentType: resp.content_type,
        contentAttributes: resp.content_attributes || {}
      });
      replyContent = null;
    } else if (resp.content_type === 'sequential_form') {
      const fields = resp.content_attributes?.items || [];
      if (fields.length === 0) {
        replyContent = 'No form fields configured.';
      } else {
        await setFormSession({ active: true, key: keyForForm || 'unknown', idx: 0, items: fields, answers: [] });
        const prompt = formIntroMsg ? `${formIntroMsg}\n${renderQuestionText(fields[0], 0)}` : renderQuestionText(fields[0], 0);
        await sendMessage(accountId, conversationId, prompt);
        replyContent = null;
      }
    } else {
      replyContent = resp.content || fallbackText || '...';
    }
  }

  async function navigateToKey(key) {
    const node = allItemsByKey.get(key);
    const kids = Array.isArray(node?.children_options) ? node.children_options : [];

    if (kids.length > 0) {
      const newPath = [...menuPath, key];
      await setMenuPath(accountId, conversationId, newPath);
      const opts = currentOptionsForPath(items, newPath);
      await sendMenu(opts, newPath);
      nextState = BOT_STATES.MENU_SENT;
    } else {
      const resp = responses[key];
      await sendResponse(resp, menuPrompt, key);
      nextState = BOT_STATES.MENU_SENT;
    }
  }

  async function processFormAnswer(field, idx, fields) {
    const v = validateAnswer(field, message, channelName === 'website');
    if (!v.ok) {
      await sendMessage(accountId, conversationId, v.hint + '\n' + renderQuestionText(field, idx));
      nextState = BOT_STATES.MENU_SENT;
      return;
    }
    if (v.attachment && attachmentAckMsg) {
      try { await sendMessage(accountId, conversationId, attachmentAckMsg); } catch (_) {}
    }
    const answers = Array.isArray(formSession.answers) ? [...formSession.answers] : [];
    answers[idx] = { name: field.name || `field_${idx + 1}`, value: v.value };
    const nextIdx = idx + 1;

    if (nextIdx >= fields.length) {
      await setFormSession({ active: false, completed: true, answers });
      await sendMessage(accountId, conversationId, formCompleteMsg);
      try {
        const submitted_values = answers.map(a => ({ name: a.name, value: a.value }));
        const summary = summarizeSubmittedValues(submitted_values);
        await sendMessage(accountId, conversationId, summary, { isPrivate: true });
      } catch (_) {}
      try {
        await saveCtx({ last_form_answers: answers.map(a => ({ name: a.name, value: a.value })) });
        await handleFormComplete(ctx, config, chatwoot, {
          channelName, accountId, conversationId, contactId,
          answers: answers.map(a => ({ name: a.name, value: a.value })),
          menuPath: ctx.menu_path || []
        });
      } catch (e) { console.error(`${logPrefix} lead features error:`, e?.response?.data || e?.message); }
    } else {
      await setFormSession({ active: true, key: formSession.key, idx: nextIdx, items: fields, answers });
      await sendMessage(accountId, conversationId, renderQuestionText(fields[nextIdx], nextIdx));
    }
    nextState = BOT_STATES.MENU_SENT;
  }

  // --- State machine ---
  let selectedKey = null;

  switch (currentState) {
    case BOT_STATES.INITIAL:
      if (formSession?.active && Array.isArray(formSession.items)) {
        const idx = Number(formSession.idx || 0);
        const field = formSession.items[idx];
        if (field) {
          await sendMessage(accountId, conversationId, renderQuestionText(field, idx));
          nextState = BOT_STATES.MENU_SENT;
          break;
        }
      }
      if (config.AGENT_REQUEST_KEYWORDS?.some(keyword => normalizedMessage?.includes(keyword))) {
        replyContent = config.HANDOFF_MESSAGE;
        nextState = BOT_STATES.MENU_SENT;
        triggerHandoff = true;
      } else {
        await sendMessage(accountId, conversationId, initialGreeting);
        await sendMenu(curOptions, menuPath);
        try { await setMenuPath(accountId, conversationId, menuPath); } catch (_) {}
        nextState = BOT_STATES.MENU_SENT;
      }
      break;

    case BOT_STATES.MENU_SENT:
      if (message?._formSubmission) {
        await sendMessage(accountId, conversationId, formCompleteMsg);
        try {
          const summary = summarizeSubmittedValues(message._formSubmission.submitted_values);
          await sendMessage(accountId, conversationId, summary, { isPrivate: true });
        } catch (_) {}
        try {
          await saveCtx({ last_form_answers: message._formSubmission.submitted_values });
          await handleFormComplete(ctx, config, chatwoot, {
            channelName, accountId, conversationId, contactId,
            answers: message._formSubmission.submitted_values,
            menuPath: ctx.menu_path || []
          });
        } catch (e) { console.error(`${logPrefix} lead features error:`, e?.response?.data || e?.message); }
        nextState = BOT_STATES.MENU_SENT;
        break;
      }

      if (formSession?.active && Array.isArray(formSession.items)) {
        const idx = Number(formSession.idx || 0);
        const fields = formSession.items;
        const field = fields[idx];
        if (!field) {
          await setFormSession({ active: false, completed: true, answers: formSession.answers || [] });
          await sendMessage(accountId, conversationId, formCompleteMsg);
          nextState = BOT_STATES.MENU_SENT;
          break;
        }
        await processFormAnswer(field, idx, fields);
        break;
      }

      if (normalizedMessage === 'options' || normalizedMessage === 'menu') {
        await sendMenu(curOptions, menuPath);
        nextState = BOT_STATES.MENU_SENT;
        break;
      }

      if (homeKeywords.includes(normalizedMessage)) {
        await setMenuPath(accountId, conversationId, []);
        const opts = currentOptionsForPath(items, []);
        await sendMenu(opts, []);
        nextState = BOT_STATES.MENU_SENT;
        break;
      }

      if (backKeywords.includes(normalizedMessage)) {
        const newPath = menuPath.length > 0 ? menuPath.slice(0, -1) : [];
        await setMenuPath(accountId, conversationId, newPath);
        const opts = currentOptionsForPath(items, newPath);
        await sendMenu(opts, newPath);
        nextState = BOT_STATES.MENU_SENT;
        break;
      }

      if (rawContent === '__back__' || normalizedMessage === '__back__') {
        const newPath = menuPath.length > 0 ? menuPath.slice(0, -1) : [];
        await setMenuPath(accountId, conversationId, newPath);
        const opts = currentOptionsForPath(items, newPath);
        await sendMenu(opts, newPath);
        nextState = BOT_STATES.MENU_SENT;
        break;
      }
      if (rawContent === '__home__' || normalizedMessage === '__home__') {
        await setMenuPath(accountId, conversationId, []);
        const opts = currentOptionsForPath(items, []);
        await sendMenu(opts, []);
        nextState = BOT_STATES.MENU_SENT;
        break;
      }

      let parsedPath = menuPath;
      let parsedKey = null;
      if (rawContent.includes('>')) {
        const parts = rawContent.split('>');
        parsedKey = parts.pop();
        parsedPath = parts;
      }

      if (/^\d+$/.test(normalizedContent) && curOptions.length > 0) {
        const idx = parseInt(normalizedContent, 10) - 1;
        if (idx >= 0 && idx < curOptions.length) {
          selectedKey = curOptions[idx].key;
        }
      } else if (parsedKey) {
        selectedKey = parsedKey;
        menuPath = parsedPath;
      } else {
        const direct = curOptions.find(o => o.key.toLowerCase() === normalizedMessage);
        if (direct) {
          selectedKey = direct.key;
        } else {
          const rawMatch = curOptions.find(o => o.key === rawContent);
          if (rawMatch) selectedKey = rawMatch.key;
        }
        if (!selectedKey) {
          for (const [k, node] of allItemsByKey) {
            if (k.toLowerCase() === normalizedMessage || k === rawContent) {
              selectedKey = k;
              const pk = parentOf.get(k);
              if (pk) {
                menuPath = [pk];
              }
              break;
            }
          }
        }
      }

      if (selectedKey && allItemsByKey.has(selectedKey)) {
        await navigateToKey(selectedKey);
      } else if (config.AGENT_REQUEST_KEYWORDS?.some(keyword => normalizedMessage?.includes(keyword))) {
        replyContent = config.HANDOFF_MESSAGE;
        nextState = BOT_STATES.MENU_SENT;
        triggerHandoff = true;
      } else {
        await sendMenu(curOptions, menuPath);
        nextState = BOT_STATES.MENU_SENT;
      }
      break;

    default:
      nextState = BOT_STATES.MENU_SENT;
      break;
  }

  if (replyContent) {
    await sendMessage(accountId, conversationId, replyContent);
  }
  if (triggerHandoff) {
    try {
      await handleHandoff(ctx, config, chatwoot, {
        channelName, accountId, conversationId, contactId, menuPath: ctx.menu_path || []
      });
    } catch (e) { console.error(`${logPrefix} handoff context error:`, e?.response?.data || e?.message); }
    await updateStatus(accountId, conversationId, 'open');
  } else if (enforcePendingStatus) {
    await updateStatus(accountId, conversationId, 'pending');
  }
  if (currentState !== nextState || ctx.state !== nextState) {
    await saveCtx({ state: nextState });
  }
}
