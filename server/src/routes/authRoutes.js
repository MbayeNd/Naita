import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { message: 'Too many sign-in attempts. Try again in 15 minutes.' } },
});

// Refreshes fire automatically (on load, and on any 401) rather than by user
// action, so a generous limit — this is guarding against abuse, not normal use.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { message: 'Too many refresh attempts. Try signing in again.' } },
});

router.post('/login', loginLimiter, validate(auth.loginSchema), auth.login);
// No `authenticate` on these two: the refresh cookie is the credential here,
// not the (possibly already-expired) access token.
router.post('/refresh', refreshLimiter, auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.me);
router.patch('/me', authenticate, validate(auth.profileSchema), auth.updateProfile);
router.patch('/me/password', authenticate, validate(auth.passwordSchema), auth.changePassword);

export default router;