import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors the mention markup logic in leadFeatures.js so we can test it.
function buildMentionPrefix(teamId, teamName, title) {
  let prefix = `🔔 ${title}`;
  if (teamId) {
    const encoded = encodeURIComponent(teamName);
    prefix = `[@${teamName}](mention://team/${teamId}/${encoded}) ${prefix}`;
  }
  return prefix;
}

test('team mention is a markdown link with url-encoded name', () => {
  const p = buildMentionPrefix(7, 'Sales Team', 'New lead — Support');
  assert.equal(p, '[@Sales Team](mention://team/7/Sales%20Team) 🔔 New lead — Support');
});

test('no team id -> plain title prefix (no mention)', () => {
  const p = buildMentionPrefix(null, 'Sales', 'New lead');
  assert.ok(!p.includes('mention://'));
  assert.ok(p.includes('🔔'));
});

test('team name with spaces & special chars is url-encoded in the link', () => {
  const p = buildMentionPrefix(12, 'Sales & Billing', 'New lead');
  assert.ok(p.startsWith('[@Sales & Billing](mention://team/12/Sales%20%26%20Billing)'));
});

// Verify the produced content would match Chatwoot's mention_service regex
// (mentions inside parens: \(mention://team/(\d+)/(.+?)\)) — markdown links
// still contain the (mention://...) parens, so the regex fires.
test('markdown-link form still matches Chatwoot mention regex', () => {
  const content = '[@Sales](mention://team/1/Sales) 🔔 New lead';
  const m = content.match(/\(mention:\/\/team\/(\d+)\/(.+?)\)/);
  assert.ok(m, 'regex should match');
  assert.equal(m[1], '1');
  assert.equal(m[2], 'Sales');
});
