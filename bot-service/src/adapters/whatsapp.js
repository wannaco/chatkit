import axios from 'axios';
import { BOT_STATES } from '../shared.js';

export function createWhatsAppAdapter(config) {
  const baseUrl = config?.CHATWOOT_BASE_URL || process.env.CHATWOOT_BASE_URL;
  const apiToken = config?.CHATWOOT_API_TOKEN;

  async function sendText(accountId, conversationId, content, isPrivate = false) {
    if (!baseUrl || !apiToken) return;
    const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    try {
      await axios.post(url, {
        content,
        message_type: 'outgoing',
        private: isPrivate
      }, { headers: { 'api_access_token': apiToken, 'Content-Type': 'application/json' } });
      console.log(`(WhatsApp) Message sent to conversation ${conversationId}.`);
    } catch (error) {
      console.error('(WhatsApp) Failed to send message:', error.response ? error.response.data : error.message);
    }
  }

  async function sendInteractive(accountId, conversationId, content, contentType, contentAttributes) {
    if (!baseUrl || !apiToken) return null;
    const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    let finalContentType = contentType;
    let finalContentAttributes = contentAttributes || {};

    if (finalContentType === 'cards' && finalContentAttributes && Array.isArray(finalContentAttributes.items)) {
      const items = finalContentAttributes.items.map((it) => {
        const hasActions = Array.isArray(it.actions) && it.actions.length > 0;
        return {
          ...it,
          actions: hasActions
            ? it.actions
            : [
              { type: 'link', text: it.text || 'View Details', uri: it.uri || 'https://example.com' },
              { type: 'postback', text: it.title || 'Select', payload: it.title || 'select_card' }
            ]
        };
      });
      finalContentAttributes = { ...finalContentAttributes, items };
    }

    if (finalContentType === 'input_select' && finalContentAttributes && Array.isArray(finalContentAttributes.items)) {
      const items = finalContentAttributes.items.map((it) => ({
        title: it.title,
        value: it.value
      }));
      finalContentAttributes = { ...finalContentAttributes, items };
    }

    const payload = {
      content,
      message_type: 'outgoing',
      private: false,
      content_type: finalContentType
    };
    if (finalContentAttributes && Object.keys(finalContentAttributes).length > 0) {
      payload.content_attributes = finalContentAttributes;
    }

    try {
      console.log(`(WhatsApp) Debug interactive payload:`, JSON.stringify(payload));
      await axios.post(url, payload, { headers: { 'api_access_token': apiToken, 'Content-Type': 'application/json' } });
      console.log(`(WhatsApp) Interactive message sent to conversation ${conversationId}.`);
      return true;
    } catch (error) {
      console.error('(WhatsApp) Failed to send interactive message:', error.response ? error.response.data : error.message);
      return false;
    }
  }

  async function sendMessage(accountId, conversationId, content, { isPrivate = false, contentType = 'text', contentAttributes = {} } = {}) {
    if (contentType !== 'text' && contentAttributes && Object.keys(contentAttributes).length > 0) {
      const sent = await sendInteractive(accountId, conversationId, content, contentType, contentAttributes);
      if (sent) return;
      console.log(`(WhatsApp) Falling back to plain text for conversation ${conversationId}.`);
    }
    await sendText(accountId, conversationId, content, isPrivate);
  }

  async function updateState(accountId, conversationId, newState, extraAttrs = undefined) {
    if (!baseUrl || !apiToken) return;
    const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/custom_attributes`;
    const custom = { bot_context: newState };
    if (extraAttrs && typeof extraAttrs === 'object') {
      for (const [k, v] of Object.entries(extraAttrs)) custom[k] = v;
    }
    try {
      await axios.post(url, { custom_attributes: custom }, { headers: { 'api_access_token': apiToken, 'Content-Type': 'application/json' } });
      console.log(`(WhatsApp) Conversation ${conversationId} state updated to ${newState}.`);
    } catch (error) {
      console.error('(WhatsApp) Failed to update state:', error.response ? error.response.data : error.message);
    }
  }

  async function updateStatus(accountId, conversationId, status) {
    if (!baseUrl || !apiToken) return;
    const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`;
    try {
      await axios.post(url, { status }, { headers: { 'api_access_token': apiToken, 'Content-Type': 'application/json' } });
      console.log(`(WhatsApp) Conversation ${conversationId} status updated to ${status}.`);
    } catch (error) {
      console.error('(WhatsApp) Failed to update status:', error.response ? error.response.data : error.message);
    }
  }

  async function setMenuPath(accountId, conversationId, path) {
    await updateState(accountId, conversationId, BOT_STATES.MENU_SENT, { bot_menu_path: JSON.stringify(path) });
  }

  function normalizeIncoming(content) {
    return content ? content.trim() : '';
  }

  return {
    channelName: 'whatsapp',
    logPrefix: '(WhatsApp)',
    supportsInteractive: true,
    enforcePendingStatus: true,
    sendMessage,
    updateState,
    updateStatus,
    setMenuPath,
    normalizeIncoming,
    config
  };
}
