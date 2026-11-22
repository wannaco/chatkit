/// <reference path="../pb_data/types.d.ts" />
// Widen settings.chatwoot_api_token to accommodate encrypted values
// (enc:v1: prefix + base64(iv + authTag + ciphertext) can exceed 500 chars).
migrate((app) => {
  const collection = app.findCollectionByNameOrId('settings');
  const field = collection.fields.find((f) => f.name === 'chatwoot_api_token');
  if (field) {
    field.max = 1000;
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('settings');
  const field = collection.fields.find((f) => f.name === 'chatwoot_api_token');
  if (field) {
    field.max = 500;
    app.save(collection);
  }
});
