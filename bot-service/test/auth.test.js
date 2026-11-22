import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.WEBHOOK_SECRET = 'top-secret';
const { requireWebhookSecret, requireBuilderAuth, buildWebhookUrl } = await import('../src/auth.js');

function mockRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
}

describe('auth', () => {
  test('webhook URL carries channel, inbox and secret', () => {
    const url = new URL(buildWebhookUrl('https://ck.example.com/', 'whatsapp', 7));
    assert.equal(url.pathname, '/webhook/whatsapp');
    assert.equal(url.searchParams.get('inboxId'), '7');
    assert.equal(url.searchParams.get('secret'), 'top-secret');
  });

  test('webhook without the secret is rejected', () => {
    const res = mockRes(); let called = false;
    requireWebhookSecret({ query: { secret: 'wrong' } }, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
  });

  test('webhook with the secret passes', () => {
    let called = false;
    requireWebhookSecret({ query: { secret: 'top-secret' } }, mockRes(), () => { called = true; });
    assert.equal(called, true);
  });

  test('/api without a token is rejected before contacting PocketBase', async () => {
    const res = mockRes(); let called = false;
    await requireBuilderAuth({ get: () => '' }, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
  });
});
