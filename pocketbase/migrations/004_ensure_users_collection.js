/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId('users');
  } catch {
    collection = new Collection({
      name: 'users',
      type: 'auth',
      fields: [
        {
          name: 'name',
          type: 'text',
          max: 200
        },
        {
          name: 'email',
          type: 'email',
          required: true
        },
        {
          name: 'avatarUrl',
          type: 'url'
        }
      ]
    });
  }

  // Allow any visitor to authenticate
  collection.listRule = '@request.auth.id != ""';
  collection.viewRule = '@request.auth.id != ""';
  collection.createRule = '';
  collection.updateRule = '@request.auth.id != "" && @request.auth.id = id';
  collection.deleteRule = '@request.auth.id != "" && @request.auth.id = id';

  app.save(collection);
}, (app) => {
  // don't delete on rollback — might have user data
});
