import { ApiError } from '../utils/ApiError.js';

/** Role gate. Usage: router.post('/', authenticate, authorize('coordinator'), handler) */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

export const isExaminer = (user) => user.role === 'chief_examiner' || user.role === 'support_examiner';
