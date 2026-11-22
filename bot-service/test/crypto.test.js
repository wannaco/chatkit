import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, isEncrypted, isEncryptionEnabled } from '../src/crypto.js';

const TEST_KEY = 'unit-test-key-0123456789abcdef';

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('crypto', () => {
  test('encrypt → decrypt roundtrips', () => {
    const plain = 'cw_7f8d6e5a4b3c2d1e0f9a8b7c6d5e4f3a';
    const encrypted = encryptSecret(plain);
    assert.ok(isEncrypted(encrypted));
    assert.ok(encrypted.startsWith('enc:v1:'));
    assert.ok(!encrypted.includes(plain), 'ciphertext must not contain the plaintext');
    assert.equal(decryptSecret(encrypted), plain);
  });

  test('same value produces different ciphertext each time (random IV)', () => {
    const a = encryptSecret('secret-token');
    const b = encryptSecret('secret-token');
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a), decryptSecret(b));
  });

  test('legacy plaintext passes through when encryption enabled', () => {
    const legacy = 'old-plaintext-token';
    assert.equal(isEncrypted(legacy), false);
    assert.equal(decryptSecret(legacy), legacy);
  });

  test('empty / null values pass through unchanged', () => {
    assert.equal(encryptSecret(''), '');
    assert.equal(encryptSecret(null), null);
    assert.equal(encryptSecret(undefined), undefined);
    assert.equal(decryptSecret(''), '');
  });

  test('tampered ciphertext decrypts to null (fail closed)', () => {
    const encrypted = encryptSecret('super-secret');
    const tampered = encrypted.slice(0, -4) + 'AAAA';
    assert.equal(decryptSecret(tampered), null);
  });

  test('wrong key decrypts to null', () => {
    const encrypted = encryptSecret('super-secret');
    process.env.ENCRYPTION_KEY = 'a-different-key';
    assert.equal(decryptSecret(encrypted), null);
  });

  test('encryption disabled (no ENCRYPTION_KEY) passes values through', () => {
    delete process.env.ENCRYPTION_KEY;
    assert.equal(isEncryptionEnabled(), false);
    const value = 'not-protected';
    assert.equal(encryptSecret(value), value);
    assert.equal(isEncrypted(value), false);
    assert.equal(decryptSecret(value), value);
  });
});
