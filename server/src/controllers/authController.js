import { z } from 'zod';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAccessToken } from '../utils/tokens.js';
import { recordAudit } from '../utils/audit.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  contactNumber: z.string().trim().max(32).optional().or(z.literal('')),
  designation: z.string().trim().max(120).optional().or(z.literal('')),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(128)
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.'),
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  // Same message for unknown email and wrong password: don't confirm which accounts exist.
  const invalid = ApiError.unauthorized('That email and password combination is not recognised.');
  if (!user) throw invalid;

  const ok = await user.verifyPassword(password);
  if (!ok) throw invalid;
  if (!user.isActive) throw ApiError.forbidden('This account is deactivated. Contact an administrator.');

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ token: signAccessToken(user), user: user.toPublic() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, contactNumber, designation } = req.body;

  const clash = await User.findOne({ email, _id: { $ne: req.user._id } });
  if (clash) throw ApiError.conflict('Another account already uses that email address.');

  Object.assign(req.user, { name, email, contactNumber: contactNumber ?? '', designation: designation ?? '' });
  await req.user.save();

  res.json({ user: req.user.toPublic() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  const ok = await user.verifyPassword(currentPassword);
  if (!ok) throw ApiError.badRequest('Your current password is not correct.');
  if (currentPassword === newPassword) throw ApiError.badRequest('Choose a password you have not used here before.');

  await user.setPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  await recordAudit({
    actor: user,
    action: 'password.changed',
    entityType: 'User',
    entityId: user._id,
    summary: `${user.name} changed their own password`,
  });

  res.json({ message: 'Password updated.' });
});
