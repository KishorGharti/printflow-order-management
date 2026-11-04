'use strict';

const crypto = require('crypto');
const { env } = require('../config/env');

// env.js already refuses to start without API_SECRET_KEY. The old built-in default is public
// (it was in the source code), so anyone could sign tokens with it: refuse it in production.
const PUBLISHED_DEFAULT_SECRET = 'printghar-secret-2026';
const SECRET_KEY = env.API_SECRET_KEY;
if (!SECRET_KEY) throw new Error('API_SECRET_KEY is required.');
if (SECRET_KEY === PUBLISHED_DEFAULT_SECRET || SECRET_KEY.length < 16) {
  if (env.NODE_ENV === 'production') {
    throw new Error('API_SECRET_KEY must be a private random value of at least 16 characters (the old default is not allowed).');
  }
  console.warn('[Security] API_SECRET_KEY is the old public default or too short. Set a long random value in backend/.env before going live.');
}
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Base64URL encode/decode helpers (RFC 7515)
 */
function base64UrlEncode(strOrBuffer) {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

const bcrypt = require('bcryptjs');

/**
 * Hash a password using scrypt with random salt (salt:key format)
 */
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(password), salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against bcrypt hash, scrypt, or legacy plaintext/PIN
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const hashStr = String(storedHash).trim();
  const passStr = String(password);

  if (hashStr.startsWith('$2a$') || hashStr.startsWith('$2b$') || hashStr.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(passStr, hashStr);
    } catch {
      return false;
    }
  }

  if (hashStr.startsWith('scrypt:')) {
    const parts = hashStr.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    const derivedKey = crypto.scryptSync(passStr, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  }

  // Fallback for direct PIN or plaintext migration
  return passStr.trim() === hashStr;
}

/** True when a stored password is still plaintext (not bcrypt or scrypt), so it should be re-hashed. */
function isLegacyPlaintext(storedHash) {
  const hashStr = String(storedHash || '').trim();
  return Boolean(hashStr) && !/^\$2[aby]\$/.test(hashStr) && !hashStr.startsWith('scrypt:');
}

/** Constant-time string comparison for secrets. */
function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const right = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(left, right);
}

/** Cryptographically random 6-digit one-time code. */
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Signs a standard JWT with HMAC-SHA256
 */
function signToken(payload, customExpirySeconds = TOKEN_EXPIRY_SECONDS) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: payload.iat !== undefined ? payload.iat : now,
    exp: now + customExpirySeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(dataToSign)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verifies a JWT token. Returns decoded payload if valid, null otherwise.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(dataToSign)
    .digest();

  const expectedEncoded = base64UrlEncode(expectedSignature);

  try {
    const sigBuf = Buffer.from(encodedSignature);
    const expBuf = Buffer.from(expectedEncoded);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson);

    // Expiration check
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a team member / employee object for public or frontend return
 */
function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password_hash;
  delete safe.passwordHash;
  delete safe.pin;
  return safe;
}

module.exports = {
  hashPassword,
  verifyPassword,
  isLegacyPlaintext,
  safeEqual,
  generateOtp,
  signToken,
  verifyToken,
  sanitizeUser,
};
