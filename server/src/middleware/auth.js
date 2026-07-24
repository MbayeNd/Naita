import { User } from '../models/User.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('This account no longer exists.');
  if (!user.isActive) throw ApiError.forbidden('This account is deactivated. Contact an administrator.');

  req.user = user;
  next();
});
