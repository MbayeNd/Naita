import jwt from 'jsonwebtoken';
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
