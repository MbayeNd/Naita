import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, issuer: 'naita-evaluation' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, { issuer: 'naita-evaluation' });
}

/** 384 bits of entropy, hex-encoded. Not a JWT — there is nothing to decode, only to hash and compare. */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/** SHA-256 is appropriate here (unlike for passwords): the input is already high-entropy random, not guessable. */
export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}