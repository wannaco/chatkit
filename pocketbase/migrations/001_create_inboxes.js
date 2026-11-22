/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: 'inboxes',
    type: 'base',
    fields: [
      {
        name: 'chatwoot_inbox_id',
        type: 'number',
        required: true,
        min: 1,
        max: 999999
      },
      {
        name: 'channel_type',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['website', 'whatsapp', 'telegram', 'messenger']
      },
      {
        name: 'name',
        type: 'text',
        required: true,
        min: 1,
        max: 200
      },
      {
        name: 'config',
        type: 'json',
        maxSize: 5000000
      },
      {
        name: 'active',
        type: 'bool',
        system: false
      }
    ]
  });

  // API rules — auth only
  collection.listRule = '@request.auth.id != ""';
  collection.viewRule = '@request.auth.id != ""';
  collection.createRule = '@request.auth.id != ""';
  collection.updateRule = '@request.auth.id != ""';
  collection.deleteRule = '@request.auth.id != ""';

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('inboxes');
  app.delete(collection);
});
