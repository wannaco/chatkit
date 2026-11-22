import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { handleBotFlow } from './botCore.js';
import { createWebsiteAdapter } from './adapters/website.js';
import { createWhatsAppAdapter } from './adapters/whatsapp.js';
import { createTelegramAdapter } from './adapters/telegram.js';
import { getConfig, getSettings } from './configLoader.js';
import { scheduleFollowUp, cancelFollowUp } from './followUpManager.js';
import { requireBuilderAuth, requireWebhookSecret, buildWebhookUrl } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());

const adapters = {
  website: createWebsiteAdapter,
  whatsapp: createWhatsAppAdapter,
  telegram: createTelegramAdapter
};

function extractEventInfo(eventData) {
  let accountId = null;
  let conversationId = null;
  let message = null;
  let customAttributes = {};
  let conversationStatus = null;
  const eventType = eventData.event;

  switch (eventType) {
    case 'message_created':
      accountId = eventData.account?.id || eventData.account_id || eventData.conversation?.account_id;
      conversationId = eventData.conversation?.id || eventData.conversation_id;
      customAttributes = eventData.conversation?.custom_attributes || {};
      conversationStatus = eventData.conversation?.status || null;
      message = eventData;
      if (!message.conversation_id) message.conversation_id = conversationId;
      if (!message.account_id) message.account_id = accountId;
      break;
    case 'message_updated':
      accountId = eventData.account?.id || eventData.account_id || eventData.conversation?.account_id;
      conversationId = eventData.conversation?.id || eventData.conversation_id;
      customAttributes = eventData.conversation?.custom_attributes || {};
      conversationStatus = eventData.conversation?.status || null;
      message = eventData;
      // input_select submission — treat as incoming user message
      if (eventData.content_type === 'input_select' && eventData.content_attributes?.submitted_values?.length > 0) {
        message.content = eventData.content_attributes.submitted_values[0].value;
        message.message_type = 'incoming';
        message.sender_type = 'contact';
      }
      // form submission from Website widget
      if (eventData.content_type === 'form' && Array.isArray(eventData.content_attributes?.submitted_values)) {
        message._formSubmission = {
          submitted_values: eventData.content_attributes.submitted_values
        };
        message.message_type = 'incoming';
        message.sender_type = 'contact';
      }
      if (!message.conversation_id) message.conversation_id = conversationId;
      if (!message.account_id) message.account_id = accountId;
      break;
    case 'conversation_updated':
    case 'conversation_status_changed':
      accountId = eventData.account?.id || eventData.account_id;
      conversationId = eventData.id || eventData.conversation_id;
      message = null;
      customAttributes = eventData.custom_attributes || eventData.additional_attributes || {};
      conversationStatus = eventData.status;
      break;
    case 'webwidget_triggered':
      accountId = eventData.account?.id || eventData.account_id;
      conversationId = eventData.id || eventData.conversation_id;
      message = null;
      customAttributes = eventData.custom_attributes || {};
      break;
    default:
      accountId = eventData.account?.id || eventData.account_id;
      conversationId = eventData.id || eventData.conversation_id;
      message = null;
  }

  // Attach the contact id (used by lead features: enrichment + handoff context).
  if (message && !message._contactId) {
    message._contactId =
      eventData.conversation?.contact_id ||
      eventData.conversation?.meta?.sender?.id ||
      eventData.contact?.id ||
      message.sender?.id ||
      message.contact_id ||
      null;
  }

  return { accountId, conversationId, message, customAttributes, conversationStatus };
}

app.post('/webhook/:channel', requireWebhookSecret, async (req, res) => {
  const channel = req.params.channel;
  const inboxId = req.query.inboxId;

  if (!adapters[channel]) {
    return res.status(400).json({ error: `Unsupported channel: ${channel}` });
  }
  if (!inboxId) {
    return res.status(400).json({ error: 'inboxId query param is required' });
  }

  try {
    const config = await getConfig(inboxId, channel);
    const adapter = adapters[channel](config);
    const eventData = req.body;
    const eventType = eventData.event;

    const { accountId, conversationId, message, customAttributes, conversationStatus } = extractEventInfo(eventData);

    if (!accountId || !conversationId) {
      return res.status(200).json({ status: 'ignored', reason: 'missing account/conversation' });
    }

    // Only process incoming messages
    if (!message || message.message_type !== 'incoming') {
      return res.status(200).json({ status: 'ignored', reason: 'not incoming message' });
    }

    // Cancel any pending follow-up — user responded
    cancelFollowUp(conversationId);

    // Only enforce pending status for channels that require it (e.g. WhatsApp)
    if (adapter.enforcePendingStatus && conversationStatus && conversationStatus !== 'pending') {
      return res.status(200).json({ status: 'ignored', reason: `conversation_status_${conversationStatus}` });
    }

    await handleBotFlow(accountId, conversationId, message, customAttributes, config, adapter);

    // Schedule follow-up reminder if configured
    scheduleFollowUp(accountId, conversationId, config, adapter);

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error(`(${channel}) Error handling webhook:`, error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Everything under /api acts on Chatwoot with the stored API token —
// only a logged-in builder user may call it.
app.use('/api', requireBuilderAuth);

// Chatwoot AgentBots proxy (avoids CORS issues from browser)
app.get('/api/agent_bots', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) return res.status(400).json({ error: 'Chatwoot not configured' });
    const { chatwoot_base_url, chatwoot_api_token, chatwoot_account_id } = settings;
    const resp = await axios.get(`${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/agent_bots`, {
      headers: { api_access_token: chatwoot_api_token }
    });
    res.json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post('/api/agent_bots', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) return res.status(400).json({ error: 'Chatwoot not configured' });
    const { chatwoot_base_url, chatwoot_api_token, chatwoot_account_id } = settings;
    const resp = await axios.post(`${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/agent_bots`, req.body, {
      headers: { api_access_token: chatwoot_api_token, 'Content-Type': 'application/json' }
    });
    res.json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

app.patch('/api/agent_bots/:id', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) return res.status(400).json({ error: 'Chatwoot not configured' });
    const { chatwoot_base_url, chatwoot_api_token, chatwoot_account_id } = settings;
    const resp = await axios.patch(`${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/agent_bots/${req.params.id}`, req.body, {
      headers: { api_access_token: chatwoot_api_token, 'Content-Type': 'application/json' }
    });
    res.json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

app.delete('/api/agent_bots/:id', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) return res.status(400).json({ error: 'Chatwoot not configured' });
    const { chatwoot_base_url, chatwoot_api_token, chatwoot_account_id } = settings;
    const resp = await axios.delete(`${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/agent_bots/${req.params.id}`, {
      headers: { api_access_token: chatwoot_api_token }
    });
    res.status(204).json({ status: 'deleted' });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

// Chatwoot Inboxes proxy
app.get('/api/inboxes', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) return res.status(400).json({ error: 'Chatwoot not configured' });
    const { chatwoot_base_url, chatwoot_api_token, chatwoot_account_id } = settings;
    const resp = await axios.get(`${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/inboxes`, {
      headers: { api_access_token: chatwoot_api_token }
    });
    res.json(resp.data?.payload || resp.data || []);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

// Assign AgentBot to Inbox
app.post('/api/assign_agent_bot', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings) return res.status(400).json({ error: 'Chatwoot not configured' });
    const { chatwoot_base_url, chatwoot_api_token, chatwoot_account_id } = settings;
    const { chatwootInboxId, agentBotId } = req.body;
    const channel = adapters[req.body.channel] ? req.body.channel : 'website';
    if (!chatwootInboxId) return res.status(400).json({ error: 'chatwootInboxId required' });

    const assignUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/inboxes/${chatwootInboxId}/set_agent_bot`;
    const resp = await axios.post(assignUrl, { agent_bot: agentBotId || null }, {
      headers: { api_access_token: chatwoot_api_token, 'Content-Type': 'application/json' }
    });

    // If assigning a bot, update its outgoing_url to point to this bot-service
    if (agentBotId) {
      const botServiceUrl = process.env.BOT_SERVICE_URL || `http://localhost:${PORT}`;
      const webhookUrl = buildWebhookUrl(botServiceUrl, channel, chatwootInboxId);
      try {
        await axios.put(`${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/agent_bots/${agentBotId}`,
          { outgoing_url: webhookUrl },
          { headers: { api_access_token: chatwoot_api_token, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.warn('Failed to update agent bot outgoing_url:', e.message);
      }
    }

    res.json({ success: true, data: resp.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ChatKit bot-service listening on port ${PORT}`);
});
