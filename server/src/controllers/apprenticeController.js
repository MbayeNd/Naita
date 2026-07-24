import { z } from 'zod';
import { Apprentice } from '../models/Apprentice.js';
import { EvaluationSession } from '../models/EvaluationSession.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordAudit } from '../utils/audit.js';

export const apprenticeSchema = z.object({
  registrationNumber: z.string().trim().min(3, 'Registration number is required.').max(40),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  contactNumber: z.string().trim().max(32).optional().or(z.literal('')),
  trainingCentre: z.string().trim().max(160).optional().or(z.literal('')),
  course: z.string().trim().max(160).optional().or(z.literal('')),
  projectTitle: z.string().trim().max(300).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const listApprentices = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.q) {
    const q = String(req.query.q).slice(0, 60);
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { registrationNumber: { $regex: q, $options: 'i' } },
    ];
  }
  const apprentices = await Apprentice.find(filter).sort({ name: 1 }).limit(500);
  res.json({ apprentices: apprentices.map((a) => a.toPublic()) });
});

export const createApprentice = asyncHandler(async (req, res) => {
  const apprentice = await Apprentice.create(req.body);
  await recordAudit({
    actor: req.user,
    action: 'apprentice.created',
    entityType: 'Apprentice',
    entityId: apprentice._id,
    summary: `${req.user.name} added apprentice ${apprentice.name}`,
  });
  res.status(201).json({ apprentice: apprentice.toPublic() });
});

export const updateApprentice = asyncHandler(async (req, res) => {
  const apprentice = await Apprentice.findById(req.params.id);
  if (!apprentice) throw ApiError.notFound('That apprentice record no longer exists.');
  Object.assign(apprentice, req.body);
  await apprentice.save();
  res.json({ apprentice: apprentice.toPublic() });
});

export const deleteApprentice = asyncHandler(async (req, res) => {
  const apprentice = await Apprentice.findById(req.params.id);
  if (!apprentice) throw ApiError.notFound('That apprentice record no longer exists.');

  const linked = await EvaluationSession.countDocuments({ apprentice: apprentice._id });
  if (linked > 0) {
    throw ApiError.conflict(
      `${apprentice.name} has ${linked} session record(s). Mark the record inactive instead so the history stays intact.`
    );
  }

  await apprentice.deleteOne();
  res.json({ message: `${apprentice.name} was removed.` });
});
