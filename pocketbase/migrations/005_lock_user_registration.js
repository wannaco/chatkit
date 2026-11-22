/// <reference path="../pb_data/types.d.ts" />
// Close public self-registration on the `users` collection.
//
// 004 set createRule = '' (anyone may sign up). Any signed-up user passes the
// `@request.auth.id != ""` rules on `settings` and `inboxes`, which would let a
// stranger read the stored Chatwoot API token. Builder users are now created by
// the superuser only (PocketBase dashboard at /_/ → users → New record).
migrate((app) => {
  const collection = app.findCollectionByNameOrId('users');
  collection.createRule = null; // superusers only
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('users');
  collection.createRule = '';
  app.save(collection);
});
