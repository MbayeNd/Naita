import { z } from 'zod';
import { User, ROLES } from '../models/User.js';
import { EvaluationSession } from '../models/EvaluationSession.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordAudit } from '../utils/audit.js';

const passwordRules = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a number.');

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: z.enum(ROLES),
  password: passwordRules,
  contactNumber: z.string().trim().max(32).optional().or(z.literal('')),
  designation: z.string().trim().max(120).optional().or(z.literal('')),
});

export const updateUserSchema = createUserSchema.omit({ password: true }).partial().extend({
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({ newPassword: passwordRules });

export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.active === 'true') filter.isActive = true;
  if (req.query.active === 'false') filter.isActive = false;
  if (req.query.q) filter.name = { $regex: String(req.query.q).slice(0, 60), $options: 'i' };

  const users = await User.find(filter).sort({ name: 1 }).limit(500);
  res.json({ users: users.map((u) => u.toPublic()) });
});

/** Examiner picker for the scheduling form — available to coordinators too. */
export const listExaminers = asyncHandler(async (_req, res) => {
  const users = await User.find({
    role: { $in: ['chief_examiner', 'support_examiner'] },
    isActive: true,
  }).sort({ name: 1 });
  res.json({ users: users.map((u) => u.toPublic()) });
});

export const createUser = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;

  const existing = await User.findOne({ email: rest.email });
  if (existing) throw ApiError.conflict('An account with that email already exists.');

  const user = new User({ ...rest, mustChangePassword: true });
  await user.setPassword(password);
  await user.save();

  await recordAudit({
    actor: req.user,
    action: 'user.created',
    entityType: 'User',
    entityId: user._id,
    summary: `${req.user.name} created ${user.name} (${user.role})`,
  });

  res.status(201).json({ user: user.toPublic() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('That user account no longer exists.');

  if (req.body.email && req.body.email !== user.email) {
    const clash = await User.findOne({ email: req.body.email, _id: { $ne: user._id } });
    if (clash) throw ApiError.conflict('Another account already uses that email address.');
  }

  // An administrator cannot lock themselves out of the system.
  const isSelf = String(user._id) === String(req.user._id);
  if (isSelf && req.body.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account.');
  }
  if (isSelf && req.body.role && req.body.role !== user.role) {
    throw ApiError.badRequest('You cannot change your own role. Ask another administrator.');
  }

  // Changing role away from examiner would orphan any session that depends on them.
  if (req.body.role && req.body.role !== user.role) {
    const assigned = await EvaluationSession.countDocuments({
      $or: [{ chiefExaminer: user._id }, { supportExaminer: user._id }],
      status: { $in: ['scheduled', 'in_progress'] },
    });
    if (assigned > 0) {
      throw ApiError.conflict(
        `${user.name} is assigned to ${assigned} upcoming session(s). Reassign those sessions first.`
      );
    }
  }

  Object.assign(user, req.body);
  await user.save();

  await recordAudit({
    actor: req.user,
    action: 'user.updated',
    entityType: 'User',
    entityId: user._id,
    summary: `${req.user.name} updated ${user.name}`,
    metadata: req.body,
  });

  res.json({ user: user.toPublic() });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('That user account no longer exists.');

  await user.setPassword(req.body.newPassword);
  user.mustChangePassword = true;
  await user.save();

  await recordAudit({
    actor: req.user,
    action: 'user.password_reset',
    entityType: 'User',
    entityId: user._id,
    summary: `${req.user.name} reset the password for ${user.name}`,
  });

  res.json({ message: `Password reset. ${user.name} must choose a new one at next sign-in.` });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('That user account no longer exists.');
  if (String(user._id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }

  const linked = await EvaluationSession.countDocuments({
    $or: [{ chiefExaminer: user._id }, { supportExaminer: user._id }, { coordinator: user._id }],
  });
  if (linked > 0) {
    throw ApiError.conflict(
      `${user.name} appears in ${linked} session record(s). Deactivate the account instead so the history stays intact.`
    );
  }

  await user.deleteOne();
  await recordAudit({
    actor: req.user,
    action: 'user.deleted',
    entityType: 'User',
    entityId: user._id,
    summary: `${req.user.name} deleted ${user.name}`,
  });

  res.json({ message: `${user.name} was removed.` });
});
