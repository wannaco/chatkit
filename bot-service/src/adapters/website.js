import axios from 'axios';
import { BOT_STATES } from '../shared.js';

export function createWebsiteAdapter(config) {
  const baseUrl = config?.CHATWOOT_BASE_URL || process.env.CHATWOOT_BASE_URL;
  const apiToken = config?.CHATWOOT_API_TOKEN;

  async function sendMessage(accountId, conversationId, content, { isPrivate = false, contentType = 'text', contentAttributes = {} } = {}) {
    if (!baseUrl || !apiToken) {
      console.error('Missing web_widget credentials: need Chatwoot base URL and API token.');
      return;
    }
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

    const payload = {
      content,
      message_type: 'outgoing',
      private: isPrivate,
      content_type: finalContentType
    };
    if (finalContentAttributes && Object.keys(finalContentAttributes).length > 0) {
      payload.content_attributes = finalContentAttributes;
    }

    try {
      if (finalContentType !== 'text' || (finalContentAttributes && Object.keys(finalContentAttributes).length > 0)) {
        console.log('(Website) Debug send payload:', JSON.stringify(payload));
      }
      await axios.post(url, payload, { headers: { 'api_access_token': apiToken, 'Content-Type': 'application/json' } });
      console.log(`(Website) Message sent to conversation ${conversationId}.`);
    } catch (error) {
      console.error('(Website) Failed to send message:', error.response ? error.response.data : error.message);
    }
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
      console.log(`(Website) Conversation ${conversationId} state updated to ${newState}.`);
    } catch (error) {
      console.error('(Website) Failed to update state:', error.response ? error.response.data : error.message);
    }
  }

  async function updateStatus(accountId, conversationId, status) {
    if (!baseUrl || !apiToken) return;
    const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`;
    try {
      await axios.post(url, { status }, { headers: { 'api_access_token': apiToken, 'Content-Type': 'application/json' } });
      console.log(`(Website) Conversation ${conversationId} status updated to ${status}.`);
    } catch (error) {
      console.error('(Website) Failed to update status:', error.response ? error.response.data : error.message);
    }
  }

  async function setMenuPath(accountId, conversationId, path) {
    await updateState(accountId, conversationId, BOT_STATES.MENU_SENT, { bot_menu_path: JSON.stringify(path) });
  }

  function normalizeIncoming(content) {
    return content ? content.replace(/<[^>]*>/g, '').trim() : '';
  }

  return {
    channelName: 'website',
    logPrefix: '(Website)',
    supportsInteractive: true,
    enforcePendingStatus: false,
    sendMessage,
    updateState,
    updateStatus,
    setMenuPath,
    normalizeIncoming,
    config
  };
}
