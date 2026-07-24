import { ApiError } from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, _next) {
  let status = error.status ?? 500;
  let message = error.message ?? 'Something went wrong on our end.';
  let details = error.details;

  if (error.name === 'ValidationError' && error.errors) {
    status = 400;
    details = Object.entries(error.errors).map(([field, e]) => ({ field, message: e.message }));
    message = 'Some fields need attention.';
  } else if (error.name === 'CastError') {
    status = 400;
    message = 'That identifier is not valid.';
  } else if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern ?? {})[0] ?? 'value';
    message = `A record with that ${field} already exists.`;
  }

  if (status >= 500) console.error('[error]', error);

  res.status(status).json({
    error: { message, details, ...(isProd ? {} : { stack: error.stack }) },
  });
}
