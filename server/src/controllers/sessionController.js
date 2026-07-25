import { z } from 'zod';
import mongoose from 'mongoose';
import { EvaluationSession } from '../models/EvaluationSession.js';
import { Evaluation } from '../models/Evaluation.js';
import { User } from '../models/User.js';
import { Apprentice } from '../models/Apprentice.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordAudit } from '../utils/audit.js';
import { isExaminer } from '../middleware/authorize.js';
import { buildResultSheet } from '../utils/resultSheet.js';
import { sendExaminerAssignedEmail } from '../utils/email.js';
const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Choose a valid option.');

export const createSessionSchema = z.object({
  apprentice: objectId,
  chiefExaminer: objectId,
  supportExaminer: objectId,
  venue: z.string().trim().min(2, 'Enter a venue.').max(160),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5, 'Minimum 5 minutes.').max(240, 'Maximum 240 minutes.'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  
});

export const updateSessionSchema = createSessionSchema.partial().extend({
  status: z.enum(['scheduled', 'cancelled']).optional(),
});

const POPULATE = [
  { path: 'apprentice', select: 'name registrationNumber projectTitle course trainingCentre' },
  { path: 'chiefExaminer', select: 'name email role' },
  { path: 'supportExaminer', select: 'name email role' },
  { path: 'coordinator', select: 'name email' },
];

/** Adds server time so clients can correct for local clock drift (SRS FR6). */
function withTiming(session) {
  const doc = session.toObject({ virtuals: true });
  const now = Date.now();
  doc.serverTime = new Date(now).toISOString();
  doc.remainingMs =
    session.status === 'in_progress' && session.endsAt ? Math.max(0, session.endsAt.getTime() - now) : 0;
  return doc;
}

/** Examiners only ever see sessions they are assigned to. */
function scopeForUser(user) {
  if (isExaminer(user)) {
    return { $or: [{ chiefExaminer: user._id }, { supportExaminer: user._id }] };
  }
  return {};
}

export const listSessions = asyncHandler(async (req, res) => {
  const filter = { ...scopeForUser(req.user) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.upcoming === 'true') {
    filter.status = { $in: ['scheduled', 'in_progress'] };
  }

  const sessions = await EvaluationSession.find(filter)
    .populate(POPULATE)
    .sort({ scheduledAt: req.query.upcoming === 'true' ? 1 : -1 })
    .limit(200);

  res.json({ sessions: sessions.map(withTiming) });
});

export const getSession = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.id).populate(POPULATE);
  if (!session) throw ApiError.notFound('That session no longer exists.');

  if (isExaminer(req.user)) {
    const assigned =
      String(session.chiefExaminer._id) === String(req.user._id) ||
      String(session.supportExaminer._id) === String(req.user._id);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this session.');
  }

  res.json({ session: withTiming(session) });
});
export const downloadResultSheet = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.id).populate(POPULATE);
  if (!session) throw ApiError.notFound('That session no longer exists.');

  if (isExaminer(req.user)) {
    const assigned =
      String(session.chiefExaminer._id) === String(req.user._id) ||
      String(session.supportExaminer._id) === String(req.user._id);
    if (!assigned) throw ApiError.forbidden('You are not assigned to this session.');
  }

  const [chiefEval, supportEval] = await Promise.all([
    Evaluation.findOne({ session: session._id, slot: 'chief' }),
    Evaluation.findOne({ session: session._id, slot: 'support' }),
  ]);

  const toPdfEvaluation = (evaluation, examinerUser) => {
    if (!evaluation || evaluation.status !== 'submitted') return null;
    return {
      examiner: { name: examinerUser?.name },
      total: evaluation.total,
      generalComment: evaluation.generalComment,
      submittedAt: evaluation.submittedAt,
      scores: evaluation.scores,
    };
  };

  const pdfSession = {
    apprentice: {
      name: session.apprentice?.name,
      registrationNumber: session.apprentice?.registrationNumber,
      course: session.apprentice?.course,
      trainingCentre: session.apprentice?.trainingCentre,
      projectTitle: session.apprentice?.projectTitle,
    },
    scheduledAt: session.scheduledAt,
    completedAt: session.completedAt,
    venue: session.venue,
    durationMinutes: session.durationMinutes,
    finalMark: session.finalMark,
    finalBand: session.finalBand,
  };

  const chief = toPdfEvaluation(chiefEval, session.chiefExaminer);
  const support = toPdfEvaluation(supportEval, session.supportExaminer);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="result-sheet-${session._id}.pdf"`);

  const doc = buildResultSheet({ session: pdfSession, chief, support });
  doc.pipe(res);
});

async function assertExaminersValid(chiefId, supportId) {
  if (String(chiefId) === String(supportId)) {
    throw ApiError.badRequest('The chief examiner and support examiner must be two different people.');
  }
  const examiners = await User.find({ _id: { $in: [chiefId, supportId] } });
  if (examiners.length !== 2) throw ApiError.badRequest('One of the selected examiners no longer exists.');
  for (const examiner of examiners) {
    if (!isExaminer(examiner)) {
      throw ApiError.badRequest(`${examiner.name} is not an examiner.`);
    }
    if (!examiner.isActive) {
      throw ApiError.badRequest(`${examiner.name}'s account is deactivated.`);
    }
  }
}

/** Assumption 2 in the SRS: an apprentice sits in only one session at a time. */
async function assertNoClash({ apprentice, chiefExaminer, supportExaminer, scheduledAt, durationMinutes, excludeId }) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const candidates = await EvaluationSession.find({
    _id: { $ne: excludeId ?? null },
    status: { $in: ['scheduled', 'in_progress'] },
    $or: [{ apprentice }, { chiefExaminer }, { supportExaminer }, { chiefExaminer: supportExaminer }, { supportExaminer: chiefExaminer }],
  }).populate(POPULATE);

  for (const other of candidates) {
    const otherStart = other.scheduledAt;
    const otherEnd = new Date(otherStart.getTime() + other.durationMinutes * 60_000);
    const overlaps = start < otherEnd && end > otherStart;
    if (!overlaps) continue;

    if (String(other.apprentice._id) === String(apprentice)) {
      throw ApiError.conflict(`${other.apprentice.name} is already booked for an overlapping session.`);
    }
    for (const slot of ['chiefExaminer', 'supportExaminer']) {
      const person = other[slot];
      if (String(person._id) === String(chiefExaminer) || String(person._id) === String(supportExaminer)) {
        throw ApiError.conflict(`${person.name} is already assigned to an overlapping session.`);
      }
    }
  }
}

export const createSession = asyncHandler(async (req, res) => {
  const { apprentice, chiefExaminer, supportExaminer, scheduledAt, durationMinutes } = req.body;

  const apprenticeDoc = await Apprentice.findById(apprentice);
  if (!apprenticeDoc) throw ApiError.badRequest('That apprentice record no longer exists.');

  await assertExaminersValid(chiefExaminer, supportExaminer);
  await assertNoClash({ apprentice, chiefExaminer, supportExaminer, scheduledAt, durationMinutes });

  const session = await EvaluationSession.create({ ...req.body, coordinator: req.user._id });

  // Create both marking sheets up front so each examiner has a stable draft to open.
  await Evaluation.insertMany([
    { session: session._id, examiner: chiefExaminer, slot: 'chief' },
    { session: session._id, examiner: supportExaminer, slot: 'support' },
  ]);

  await session.populate(POPULATE);
  await sendExaminerAssignedEmail({ examiner: session.chiefExaminer, session, apprentice: apprenticeDoc, role: 'chief' });
  await sendExaminerAssignedEmail({ examiner: session.supportExaminer, session, apprentice: apprenticeDoc, role: 'support' });
  await recordAudit({
    actor: req.user,
    action: 'session.created',
    entityType: 'EvaluationSession',
    entityId: session._id,
    summary: `${req.user.name} scheduled ${apprenticeDoc.name} for ${session.scheduledAt.toISOString()}`,
  });

  res.status(201).json({ session: withTiming(session) });
});

export const updateSession = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.id);
  if (!session) throw ApiError.notFound('That session no longer exists.');
  if (session.status === 'in_progress') {
    throw ApiError.conflict('This session is running. Wait for the timer to finish before editing it.');
  }
  if (session.status === 'completed') {
    throw ApiError.conflict('Completed sessions cannot be edited.');
  }

  const next = { ...session.toObject(), ...req.body };
  await assertExaminersValid(next.chiefExaminer, next.supportExaminer);
  await assertNoClash({
    apprentice: next.apprentice,
    chiefExaminer: next.chiefExaminer,
    supportExaminer: next.supportExaminer,
    scheduledAt: next.scheduledAt,
    durationMinutes: next.durationMinutes,
    excludeId: session._id,
  });

  const chiefChanged = String(next.chiefExaminer) !== String(session.chiefExaminer);
  const supportChanged = String(next.supportExaminer) !== String(session.supportExaminer);

  Object.assign(session, req.body);
  await session.save();

  // Keep the marking sheets pointing at whoever is now assigned.
  if (chiefChanged) {
    await Evaluation.updateOne(
      { session: session._id, slot: 'chief' },
      { examiner: session.chiefExaminer, scores: [], total: null, status: 'draft', submittedAt: null }
    );
  }
  if (supportChanged) {
    await Evaluation.updateOne(
      { session: session._id, slot: 'support' },
      { examiner: session.supportExaminer, scores: [], total: null, status: 'draft', submittedAt: null }
    );
  }

  await session.populate(POPULATE);
   if (chiefChanged) {
    await sendExaminerAssignedEmail({ examiner: session.chiefExaminer, session, apprentice: session.apprentice, role: 'chief' });
  }
  if (supportChanged) {
    await sendExaminerAssignedEmail({ examiner: session.supportExaminer, session, apprentice: session.apprentice, role: 'support' });
  }

  res.json({ session: withTiming(session) });
});

/** Business Rule 4: only the coordinator may start the timer. */
export const startSession = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.id).populate(POPULATE);
  if (!session) throw ApiError.notFound('That session no longer exists.');
  if (session.status === 'in_progress') throw ApiError.conflict('This session is already running.');
  if (session.status !== 'scheduled') throw ApiError.conflict('Only a scheduled session can be started.');

  const now = new Date();
  session.status = 'in_progress';
  session.startedAt = now;
  session.endsAt = new Date(now.getTime() + session.durationMinutes * 60_000);
  session.startedBy = req.user._id;
  await session.save();

  await recordAudit({
    actor: req.user,
    action: 'session.started',
    entityType: 'EvaluationSession',
    entityId: session._id,
    summary: `${req.user.name} started the timer (${session.durationMinutes} min)`,
  });

  res.json({ session: withTiming(session) });
});

/** Lightweight polling endpoint — examiner screens hit this to stay in sync. */
export const getTimer = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.id).select(
    'status startedAt endsAt durationMinutes'
  );
  if (!session) throw ApiError.notFound('That session no longer exists.');

  const now = Date.now();
  res.json({
    status: session.status,
    serverTime: new Date(now).toISOString(),
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    durationMinutes: session.durationMinutes,
    remainingMs: session.status === 'in_progress' && session.endsAt ? Math.max(0, session.endsAt.getTime() - now) : 0,
  });
});

export const cancelSession = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.id);
  if (!session) throw ApiError.notFound('That session no longer exists.');
  if (session.status === 'completed') throw ApiError.conflict('Completed sessions cannot be cancelled.');

  session.status = 'cancelled';
  await session.save();

  await recordAudit({
    actor: req.user,
    action: 'session.cancelled',
    entityType: 'EvaluationSession',
    entityId: session._id,
    summary: `${req.user.name} cancelled the session`,
  });

  res.json({ message: 'Session cancelled.' });
});
