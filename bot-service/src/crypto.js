import crypto from 'node:crypto';

/**
 * Field-level encryption for sensitive values stored in PocketBase
 * (chatwoot_api_token, crmWebhookSecret, ...).
 *
 * Design rules:
 *  - The key NEVER leaves the bot-service. It comes from the ENCRYPTION_KEY
 *    environment variable (set in the deployment env, never in the browser).
 *  - The builder-ui is a client-side SPA, so it can never hold the key.
 *    It asks THIS service to encrypt values before persisting them, and it
 *    never displays stored secrets back (they are write-only).
 *  - There is deliberately NO decrypt endpoint: decryption only happens
 *    in-process where the key lives.
 *  - If ENCRYPTION_KEY is not set, encryption is disabled (fail-safe: values
 *    pass through unchanged so existing installs keep working) and a loud
 *    warning is logged. Set the key to get real protection.
 */

const PREFIX = 'enc:v1:';

export function isEncryptionEnabled() {
  return !!(process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.trim());
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function getKey() {
  // Deterministic 32-byte key derived from ENCRYPTION_KEY via SHA-256.
  // The hash derivation keeps the required secret short and human-memorable.
  const secret = process.env.ENCRYPTION_KEY || '';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string. Returns the encrypted payload string
 * (prefix + base64(iv + authTag + ciphertext)).
 * When encryption is disabled (no ENCRYPTION_KEY), returns the input unchanged.
 */
export function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const value = String(plaintext);
  if (value === '') return value;
  if (!isEncryptionEnabled()) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt a value previously produced by encryptSecret.
 *  - Values that are not encrypted (legacy plaintext or empty) pass through.
 *  - On tamper/wrong-key, returns null (fail closed) and logs — callers must
 *    treat null as "secret unavailable", not fall back to plaintext.
 */
export function decryptSecret(payload) {
  if (typeof payload !== 'string' || payload === '') return payload;
  if (!isEncrypted(payload)) return payload; // legacy plaintext
  if (!isEncryptionEnabled()) {
    console.error('[crypto] Cannot decrypt: ENCRYPTION_KEY is not set.');
    return null;
  }
  try {
    const buf = Buffer.from(payload.slice(PREFIX.length), 'base64');
    if (buf.length < 29) throw new Error('payload too short');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc, null, 'utf8') + decipher.final('utf8');
  } catch (err) {
    console.error('[crypto] decrypt failed (wrong ENCRYPTION_KEY or corrupted value):', err.message);
    return null;
  }
}
