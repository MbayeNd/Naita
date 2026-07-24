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
  message: { error: { message: 'Too many sign-in attempts. Try again in 15 minutes.' } },
});

router.post('/login', loginLimiter, validate(auth.loginSchema), auth.login);
router.get('/me', authenticate, auth.me);
router.patch('/me', authenticate, validate(auth.profileSchema), auth.updateProfile);
router.patch('/me/password', authenticate, validate(auth.passwordSchema), auth.changePassword);

export default router;
