import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { env, isProd } from '../config/env.js';
import { generateRefreshToken, hashRefreshToken } from './tokens.js';

export const REFRESH_COOKIE_NAME = 'naita_rt';

const REFRESH_TTL_MS = env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000;

/**
 * Scoped to /api/auth so the browser only sends this cookie to the three
 * endpoints that need it, not to every API call. SameSite=None is required
 * for the frontend and backend living on different domains (Netlify /
 * Vercel); that in turn requires Secure, which only works over HTTPS — fine
 * in production, so local HTTP development falls back to Lax instead.
 */
export function refreshCookieOptions(maxAgeMs = REFRESH_TTL_MS) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: maxAgeMs,
  };
}

function requestMeta(req) {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 300),
    ip: req.ip,
  };
}

/** Called on login. Returns the raw token — only this call site ever sees it unhashed. */
export async function issueSession(user, req) {
  const rawToken = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    ...requestMeta(req),
  });
  return rawToken;
}

/**
 * Called on /auth/refresh. Every successful call consumes the presented token
 * and issues a new one (rotation) — a token is single-use.
 */
export async function rotateSession(rawToken, req) {
  if (!rawToken) return { status: 'missing' };

  const record = await RefreshToken.findOne({ tokenHash: hashRefreshToken(rawToken) });
  if (!record) return { status: 'invalid' };

  if (record.revokedAt) {
    await revokeAllSessionsForUser(record.user);
    return { status: 'reused' };
  }
  if (record.expiresAt.getTime() < Date.now()) return { status: 'expired' };

  const user = await User.findById(record.user);
  if (!user || !user.isActive) return { status: 'invalid' };

  const newRawToken = generateRefreshToken();
  record.revokedAt = new Date();
  record.replacedByHash = hashRefreshToken(newRawToken);
  await record.save();

  await RefreshToken.create({
    user: user._id,
    tokenHash: record.replacedByHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    ...requestMeta(req),
  });

  return { status: 'ok', user, rawToken: newRawToken };
}

/** Called on logout. Idempotent. */
export async function revokeSession(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { revokedAt: new Date() }
  );
}

/** Called on password change/reset — invalidates every other device's session in one step. */
export async function revokeAllSessionsForUser(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}