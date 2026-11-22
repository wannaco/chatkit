/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Seed a demo inbox config
  const collection = app.findCollectionByNameOrId('inboxes');

  const demoConfig = {
    INITIAL_RESPONSE: 'Hello! How can we help you today?',
    MENU_PROMPT: 'Please choose an option:',
    MENU_ITEMS: [
      {
        key: 'Sales',
        response: 'Contact our sales team at sales@example.com or call 555-0100.',
        children_options: []
      },
      {
        key: 'Support',
        response: { content_type: 'submenu' },
        children_options: [
          {
            key: 'Billing',
            label: 'Billing',
            response: 'For billing questions, email billing@example.com.',
            children_options: []
          },
          {
            key: 'Technical',
            label: 'Technical',
            response: 'For technical issues, email support@example.com.',
            children_options: []
          }
        ]
      },
      {
        key: 'Hours',
        response: 'We are open Mon-Fri 9am-6pm EST.',
        children_options: []
      }
    ],
    BACK_KEYWORDS: ['back', 'return'],
    HOME_KEYWORDS: ['home', 'menu'],
    BACK_HOME_HINT: "Reply 'back' to go back, 'home' for main menu",
    AGENT_REQUEST_KEYWORDS: ['agent', 'human'],
    HANDOFF_MESSAGE: 'Connecting you to a team member...',
    ATTACHMENT_ACK_MESSAGE: 'We received your attachment, thank you.',
    FORM_INTRO_MESSAGE: 'Please answer the following questions:',
    FORM_COMPLETE_MESSAGE: 'Thank you! Your responses have been submitted.',
    crmWebhookUrl: '',
    crmWebhookSecret: ''
  };

  const record = new Record(collection, {
    chatwoot_inbox_id: 1,
    channel_type: 'website',
    name: 'Demo Inbox',
    config: demoConfig,
    active: true
  });

  app.save(record);
}, (app) => {
  // Cleanup demo record
  try {
    const records = app.findRecordsByFilter('inboxes', 'name = "Demo Inbox"');
    for (const r of records) app.delete(r);
  } catch (_) {}
});
