import { z } from 'zod';
import { Evaluation } from '../models/Evaluation.js';
import { EvaluationSession } from '../models/EvaluationSession.js';
import { AuditLog } from '../models/AuditLog.js';
import { CRITERION_IDS, getRubric } from '../config/rubric.js';
import { calculateTotal, calculateFinalMark, findMissingCriteria, bandForScore } from '../utils/scoring.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordAudit } from '../utils/audit.js';
import { isExaminer } from '../middleware/authorize.js';

export const saveScoresSchema = z.object({
  scores: z
    .array(
      z.object({
        criterionId: z.enum(CRITERION_IDS),
        score: z.number().min(0, 'Marks run from 0 to 100.').max(100, 'Marks run from 0 to 100.').nullable(),
        comment: z.string().trim().max(1000).optional().or(z.literal('')),
      })
    )
    .max(CRITERION_IDS.length),
  generalComment: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(5, 'Give a reason so the record explains itself later.').max(500),
});

export const rubric = (_req, res) => res.json(getRubric());

/** Recomputes the session's final mark once, and only once, both sheets are in. */
async function refreshFinalMark(sessionId) {
  const evaluations = await Evaluation.find({ session: sessionId });
  const chief = evaluations.find((e) => e.slot === 'chief');
  const support = evaluations.find((e) => e.slot === 'support');
  const bothSubmitted = chief?.status === 'submitted' && support?.status === 'submitted';

  const session = await EvaluationSession.findById(sessionId);
  if (!session) return null;

  if (bothSubmitted) {
    session.finalMark = calculateFinalMark(chief.total, support.total);
    session.finalBand = bandForScore(session.finalMark);
    session.status = 'completed';
    session.completedAt = new Date();
  } else {
    // A reopened sheet pulls the session back out of "completed".
    session.finalMark = null;
    session.finalBand = null;
    session.completedAt = null;
    if (session.status === 'completed') {
      session.status = session.startedAt ? 'in_progress' : 'scheduled';
    }
  }

  await session.save();
  return session;
}

async function loadOwnEvaluation(sessionId, user) {
  const session = await EvaluationSession.findById(sessionId);
  if (!session) throw ApiError.notFound('That session no longer exists.');

  const evaluation = await Evaluation.findOne({ session: sessionId, examiner: user._id });
  if (!evaluation) throw ApiError.forbidden('You are not assigned to this session.');

  return { session, evaluation };
}

/** The examiner's own marking sheet. */
export const getMyEvaluation = asyncHandler(async (req, res) => {
  const { evaluation } = await loadOwnEvaluation(req.params.sessionId, req.user);
  res.json({ evaluation, rubric: getRubric() });
});

/** Autosaved draft. Partial scores are fine here; completeness is checked on submit. */
export const saveMyEvaluation = asyncHandler(async (req, res) => {
  const { session, evaluation } = await loadOwnEvaluation(req.params.sessionId, req.user);

  if (evaluation.status === 'submitted') {
    throw ApiError.conflict('Your marks are submitted and locked. An administrator can reopen the sheet if a change is needed.');
  }
  if (session.status === 'cancelled') throw ApiError.conflict('This session was cancelled.');

  evaluation.scores = req.body.scores.map((s) => ({
    criterionId: s.criterionId,
    score: s.score,
    band: bandForScore(s.score),
    comment: s.comment ?? '',
  }));
  evaluation.generalComment = req.body.generalComment ?? '';
  evaluation.total = calculateTotal(evaluation.scores);
  await evaluation.save();

  res.json({ evaluation });
});

/** Business Rules 2 and 6. */
export const submitMyEvaluation = asyncHandler(async (req, res) => {
  const { session, evaluation } = await loadOwnEvaluation(req.params.sessionId, req.user);

  if (evaluation.status === 'submitted') {
    throw ApiError.conflict('You have already submitted marks for this session.');
  }
  if (session.status === 'cancelled') throw ApiError.conflict('This session was cancelled.');

  const missing = findMissingCriteria(evaluation.scores);
  if (missing.length > 0) {
    throw ApiError.badRequest('Score every criterion before submitting.', missing.map((id) => ({ field: id, message: 'Not scored yet.' })));
  }

  evaluation.total = calculateTotal(evaluation.scores);
  evaluation.status = 'submitted';
  evaluation.submittedAt = new Date();
  await evaluation.save();

  const updatedSession = await refreshFinalMark(session._id);

  await recordAudit({
    actor: req.user,
    action: 'evaluation.submitted',
    entityType: 'Evaluation',
    entityId: evaluation._id,
    summary: `${req.user.name} submitted marks (total ${evaluation.total})`,
    metadata: { sessionId: String(session._id), total: evaluation.total },
  });

  res.json({
    evaluation,
    finalMark: updatedSession?.finalMark ?? null,
    sessionStatus: updatedSession?.status,
  });
});

/** Coordinator / admin view: both sheets side by side plus the computed final mark. */
export const getSessionResults = asyncHandler(async (req, res) => {
  const session = await EvaluationSession.findById(req.params.sessionId).populate([
    { path: 'apprentice', select: 'name registrationNumber projectTitle course' },
    { path: 'chiefExaminer', select: 'name email' },
    { path: 'supportExaminer', select: 'name email' },
  ]);
  if (!session) throw ApiError.notFound('That session no longer exists.');

  const evaluations = await Evaluation.find({ session: session._id }).populate('examiner', 'name email');
  const chief = evaluations.find((e) => e.slot === 'chief') ?? null;
  const support = evaluations.find((e) => e.slot === 'support') ?? null;

  const spread =
    chief?.status === 'submitted' && support?.status === 'submitted'
      ? Math.abs(chief.total - support.total)
      : null;

  res.json({
    session,
    chief,
    support,
    rubric: getRubric(),
    finalMark: session.finalMark,
    finalBand: session.finalBand,
    // Surfaced, not enforced: a wide gap between examiners is worth a human look.
    examinerSpread: spread,
    spreadFlagged: spread !== null && spread >= 15,
  });
});

/** Business Rule 3: administrators only. */
export const reopenEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await Evaluation.findById(req.params.id).populate('examiner', 'name');
  if (!evaluation) throw ApiError.notFound('That marking sheet no longer exists.');
  if (evaluation.status !== 'submitted') throw ApiError.conflict('That marking sheet is not locked.');

  evaluation.status = 'draft';
  evaluation.submittedAt = null;
  evaluation.reopenCount += 1;
  evaluation.lastReopenedBy = req.user._id;
  evaluation.lastReopenedAt = new Date();
  evaluation.lastReopenReason = req.body.reason;
  await evaluation.save();

  const session = await refreshFinalMark(evaluation.session);

  await recordAudit({
    actor: req.user,
    action: 'evaluation.reopened',
    entityType: 'Evaluation',
    entityId: evaluation._id,
    summary: `${req.user.name} reopened ${evaluation.examiner.name}'s marks`,
    metadata: { reason: req.body.reason, sessionId: String(evaluation.session) },
  });

  res.json({ evaluation, sessionStatus: session?.status });
});

/** Evaluation history — scoped by role. */
export const listResults = asyncHandler(async (req, res) => {
  const filter = { status: 'completed' };
  if (req.query.apprentice) filter.apprentice = req.query.apprentice;
  if (isExaminer(req.user)) {
    filter.$or = [{ chiefExaminer: req.user._id }, { supportExaminer: req.user._id }];
  }

  const sessions = await EvaluationSession.find(filter)
    .populate([
      { path: 'apprentice', select: 'name registrationNumber projectTitle' },
      { path: 'chiefExaminer', select: 'name' },
      { path: 'supportExaminer', select: 'name' },
    ])
    .sort({ completedAt: -1 })
    .limit(200);

  res.json({ results: sessions });
});

export const listAudit = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  const entries = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(200).populate('actor', 'name role');
  res.json({ entries });
});
