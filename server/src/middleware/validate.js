import { ApiError } from '../utils/ApiError.js';

/** Validates req[source] against a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    return next(ApiError.badRequest('Some fields need attention.', details));
  }
  if (source === 'body') req.body = result.data;
  else req.validated = result.data;
  next();
};
