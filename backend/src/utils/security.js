const crypto = require('crypto');

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

function timingSafeEqualString(a, b) {
  const bufferA = Buffer.from(String(a || ''));
  const bufferB = Buffer.from(String(b || ''));
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

function isHashedPassword(value) {
  return typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);
}

function verifyPassword(password, storedValue) {
  if (!storedValue) return false;
  const raw = String(storedValue);

  if (isHashedPassword(raw)) {
    const [, salt, hash] = raw.split('$');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
    return timingSafeEqualString(candidate, hash);
  }

  return timingSafeEqualString(String(password), raw.trim());
}

function shouldUpgradePasswordHash(storedValue) {
  return !!storedValue && !isHashedPassword(storedValue);
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signToken(payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', String(secret))
    .update(encodedPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedPayload}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', String(secret))
    .update(encodedPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (!timingSafeEqualString(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  shouldUpgradePasswordHash,
  signToken,
  verifyToken,
};
