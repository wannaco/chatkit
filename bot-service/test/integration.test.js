import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BOT_STATES, buildMenuMessage, currentOptionsForPath, normalizeKeywordArray, validateAnswer } from '../src/shared.js';

describe('Bot flow integration scenarios', () => {
  const sampleConfig = {
    inbox: {
      id: 1,
      INITIAL_RESPONSE: 'Welcome!',
      MENU_PROMPT: 'Choose:',
      MENU_ITEMS: [
        { key: 'Sales', response: 'Contact sales@example.com', children_options: [] },
        { key: 'Support', response: { content_type: 'submenu' }, children_options: [
          { key: 'Billing', label: 'Billing', response: 'Billing team: billing@example.com', children_options: [] },
          { key: 'Technical', label: 'Technical', response: 'Tech team: tech@example.com', children_options: [] }
        ]},
        { key: 'Hours', response: 'Mon-Fri 9am-6pm', children_options: [] }
      ],
      BACK_KEYWORDS: ['back'],
      HOME_KEYWORDS: ['home', 'menu'],
      AGENT_REQUEST_KEYWORDS: ['agent'],
      HANDOFF_MESSAGE: 'Connecting you to an agent...'
    },
    AGENT_REQUEST_KEYWORDS: ['agent'],
    HANDOFF_MESSAGE: 'Connecting you to an agent...'
  };

  test('root menu has 3 options', () => {
    const opts = currentOptionsForPath(sampleConfig.inbox.MENU_ITEMS, []);
    assert.equal(opts.length, 3);
    assert.equal(opts[0].key, 'Sales');
    assert.equal(opts[1].key, 'Support');
    assert.equal(opts[2].key, 'Hours');
  });

  test('Support submenu has 2 children', () => {
    const opts = currentOptionsForPath(sampleConfig.inbox.MENU_ITEMS, ['Support']);
    assert.equal(opts.length, 2);
    assert.equal(opts[0].key, 'Billing');
    assert.equal(opts[1].key, 'Technical');
  });

  test('interactive menu at root has no back/home buttons', () => {
    const opts = currentOptionsForPath(sampleConfig.inbox.MENU_ITEMS, []);
    const msg = buildMenuMessage('Choose:', opts, '', 'Back', 'Home');
    assert.equal(msg.content_attributes.items.length, 3);
    assert.ok(!msg.content_attributes.items.some((i) => i.value === '__back__'));
    assert.ok(!msg.content_attributes.items.some((i) => i.value === '__home__'));
  });

  test('interactive menu in submenu has back/home buttons', () => {
    const opts = currentOptionsForPath(sampleConfig.inbox.MENU_ITEMS, ['Support']);
    const msg = buildMenuMessage('Choose:', opts, 'Support', 'Back', 'Home');
    const items = msg.content_attributes.items;
    assert.equal(items.length, 4);
    assert.ok(items.some((i) => i.value === '__back__'));
    assert.ok(items.some((i) => i.value === '__home__'));
    assert.ok(items.some((i) => i.value === 'Support>Billing'));
  });

  test('agent keywords trigger handoff message', () => {
    const agentKeywords = normalizeKeywordArray(sampleConfig.AGENT_REQUEST_KEYWORDS, []);
    assert.ok(agentKeywords.includes('agent'));
    assert.equal(sampleConfig.HANDOFF_MESSAGE, 'Connecting you to an agent...');
  });

  test('form validation: email field', () => {
    const field = { type: 'email' };
    assert.ok(validateAnswer(field, { content: 'test@example.com' }, false).ok);
    assert.ok(!validateAnswer(field, { content: 'not-email' }, false).ok);
  });

  test('form validation: number field', () => {
    const field = { type: 'number' };
    assert.ok(validateAnswer(field, { content: '42' }, false).ok);
    assert.ok(!validateAnswer(field, { content: 'abc' }, false).ok);
  });

  test('form validation: select field with numeric answer', () => {
    const field = { type: 'select', options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }] };
    const result = validateAnswer(field, { content: '1' }, false);
    assert.ok(result.ok);
    assert.equal(result.value, 'red');
  });

  test('form validation: attachment accepted', () => {
    const field = { type: 'text' };
    const result = validateAnswer(field, { content: '', attachments: [{ data_url: 'https://example.com/file.pdf' }] }, false);
    assert.ok(result.ok);
    assert.equal(result.value, 'https://example.com/file.pdf');
    assert.equal(result.attachment, true);
  });

  test('back/home keywords are normalized to lowercase', () => {
    const back = normalizeKeywordArray(['Back', 'Return'], []);
    assert.deepEqual(back, ['back', 'return']);
    const home = normalizeKeywordArray(['Home', 'Menu'], []);
    assert.deepEqual(home, ['home', 'menu']);
  });
});
