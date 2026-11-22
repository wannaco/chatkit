import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_STATES,
  normalizeKeywordArray,
  indexMenuItems,
  currentOptionsForPath,
  buildMenuMessage,
  buildMenuTextLines,
  summarizeSubmittedValues,
  validateAnswer,
  renderQuestionText
} from '../src/shared.js';

test('BOT_STATES has INITIAL and MENU_SENT', () => {
  assert.equal(BOT_STATES.INITIAL, 'INITIAL');
  assert.equal(BOT_STATES.MENU_SENT, 'MENU_SENT');
});

test('normalizeKeywordArray handles arrays, strings, JSON, and defaults', () => {
  assert.deepEqual(normalizeKeywordArray(['Back', 'Return']), ['back', 'return']);
  assert.deepEqual(normalizeKeywordArray('back,return'), ['back', 'return']);
  assert.deepEqual(normalizeKeywordArray('["back","return"]'), ['back', 'return']);
  assert.deepEqual(normalizeKeywordArray(null, ['back']), ['back']);
  assert.deepEqual(normalizeKeywordArray('', ['home']), ['home']);
});

test('indexMenuItems builds byKey and roots', () => {
  const items = [
    { key: 'Sales', response: 'text', children_options: [] },
    { key: 'Support', response: { content_type: 'submenu' }, children_options: [
      { key: 'Billing', label: 'Billing' }
    ]}
  ];
  const { byKey, roots } = indexMenuItems(items);
  assert.ok(byKey.has('Sales'));
  assert.ok(byKey.has('Support'));
  assert.ok(byKey.has('Billing'));
  assert.ok(roots.includes('Sales'));
  assert.ok(roots.includes('Support'));
  assert.ok(!roots.includes('Billing'));
});

test('currentOptionsForPath returns roots at empty path', () => {
  const items = [
    { key: 'A', children_options: [] },
    { key: 'B', children_options: [{ key: 'C', label: 'C' }] }
  ];
  const opts = currentOptionsForPath(items, []);
  assert.equal(opts.length, 2);
  assert.equal(opts[0].key, 'A');
  assert.equal(opts[1].key, 'B');
});

test('currentOptionsForPath returns children at nested path', () => {
  const items = [
    { key: 'B', children_options: [{ key: 'C', label: 'C' }] }
  ];
  const opts = currentOptionsForPath(items, ['B']);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].key, 'C');
  assert.equal(opts[0].label, 'C');
});

test('buildMenuMessage encodes path in values', () => {
  const opts = [{ key: 'Sales', label: 'Sales' }];
  const msg = buildMenuMessage('Choose:', opts, 'Teams');
  assert.equal(msg.content, 'Choose:');
  assert.equal(msg.content_type, 'input_select');
  assert.equal(msg.content_attributes.items[0].title, 'Sales');
  assert.equal(msg.content_attributes.items[0].value, 'Teams>Sales');
});

test('buildMenuMessage adds back/home buttons in submenu', () => {
  const opts = [{ key: 'X', label: 'X' }];
  const msg = buildMenuMessage('Choose:', opts, 'Parent', 'Back', 'Home');
  const items = msg.content_attributes.items;
  assert.equal(items.length, 3);
  assert.equal(items[1].title, 'Home');
  assert.equal(items[1].value, '__home__');
  assert.equal(items[2].title, 'Back');
  assert.equal(items[2].value, '__back__');
});

test('buildMenuMessage does NOT add back/home at root', () => {
  const opts = [{ key: 'X', label: 'X' }];
  const msg = buildMenuMessage('Choose:', opts, '', 'Back', 'Home');
  assert.equal(msg.content_attributes.items.length, 1);
});

test('buildMenuMessage returns null for empty options', () => {
  assert.equal(buildMenuMessage('x', [], ''), null);
});

test('buildMenuTextLines includes numbered options', () => {
  const lines = buildMenuTextLines('Choose:', [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }], ['back'], ['home']);
  assert.ok(lines[0].includes('Choose:'));
  assert.ok(lines[1].includes('1. A'));
  assert.ok(lines[2].includes('2. B'));
});

test('summarizeSubmittedValues formats correctly', () => {
  const summary = summarizeSubmittedValues([{ name: 'Email', value: 'test@test.com' }]);
  assert.ok(summary.includes('Email: test@test.com'));
});

test('validateAnswer accepts valid email', () => {
  const result = validateAnswer({ type: 'email' }, { content: 'test@test.com' }, false);
  assert.equal(result.ok, true);
  assert.equal(result.value, 'test@test.com');
});

test('validateAnswer rejects invalid email', () => {
  const result = validateAnswer({ type: 'email' }, { content: 'notanemail' }, false);
  assert.equal(result.ok, false);
});

test('validateAnswer accepts valid number', () => {
  const result = validateAnswer({ type: 'number' }, { content: '42' }, false);
  assert.equal(result.ok, true);
  assert.equal(result.value, '42');
});

test('renderQuestionText formats select options', () => {
  const text = renderQuestionText({
    label: 'Choose color',
    type: 'select',
    options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }]
  }, 0);
  assert.ok(text.includes('Choose color'));
  assert.ok(text.includes('1. Red'));
  assert.ok(text.includes('2. Blue'));
});

test('renderQuestionText formats file upload prompt', () => {
  const text = renderQuestionText({ label: 'Upload ID', type: 'image' }, 0);
  assert.ok(text.includes('please send a image'));
});
