/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: 'settings',
    type: 'base',
    fields: [
      {
        name: 'chatwoot_base_url',
        type: 'url',
        required: false
      },
      {
        name: 'chatwoot_api_token',
        type: 'text',
        required: false,
        min: 0,
        max: 500
      },
      {
        name: 'chatwoot_account_id',
        type: 'number',
        required: false,
        min: 1,
        max: 999999
      },
      {
        name: 'branding',
        type: 'json',
        maxSize: 1000000
      }
    ]
  });

  collection.listRule = '@request.auth.id != ""';
  collection.viewRule = '@request.auth.id != ""';
  collection.createRule = '@request.auth.id != ""';
  collection.updateRule = '@request.auth.id != ""';
  collection.deleteRule = '@request.auth.id != ""';

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('settings');
  app.delete(collection);
});
