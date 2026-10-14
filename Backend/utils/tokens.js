const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function secretFor(kind) {
  const dedicated = kind === 'access'
    ? process.env.JWT_ACCESS_SECRET
    : process.env.JWT_REFRESH_SECRET;
  if (dedicated) return dedicated;

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET or token-specific JWT secrets must be configured.');
  }
  if (kind === 'access') return process.env.JWT_SECRET;
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update('ecommerce-refresh-token-signing-key')
    .digest('hex');
}

function createTokenPair(user) {
  const claims = {
    sub: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
    jti: crypto.randomUUID(),
  };
  const accessToken = jwt.sign(claims, secretFor('access'), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(
    {
      sub: user.id,
      tokenVersion: user.tokenVersion,
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    secretFor('refresh'),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
}

function verifyToken(token, kind) {
  return jwt.verify(token, secretFor(kind));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { createTokenPair, verifyToken, hashToken };
