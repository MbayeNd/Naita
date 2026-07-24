import { Router } from 'express';
import * as sessions from '../controllers/sessionController.js';
import * as evaluations from '../controllers/evaluationController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

router.get('/', sessions.listSessions);
router.post('/', authorize('admin', 'coordinator'), validate(sessions.createSessionSchema), sessions.createSession);
router.get('/:id', sessions.getSession);
router.patch('/:id', authorize('admin', 'coordinator'), validate(sessions.updateSessionSchema), sessions.updateSession);
router.delete('/:id', authorize('admin', 'coordinator'), sessions.cancelSession);

// Business Rule 4 — the coordinator (or an admin covering for one) starts the clock.
router.post('/:id/start', authorize('admin', 'coordinator'), sessions.startSession);
router.get('/:id/timer', sessions.getTimer);

// Marking sheets hang off the session.
router.get('/:sessionId/my-evaluation', authorize('chief_examiner', 'support_examiner'), evaluations.getMyEvaluation);
router.put(
  '/:sessionId/my-evaluation',
  authorize('chief_examiner', 'support_examiner'),
  validate(evaluations.saveScoresSchema),
  evaluations.saveMyEvaluation
);
router.post('/:sessionId/my-evaluation/submit', authorize('chief_examiner', 'support_examiner'), evaluations.submitMyEvaluation);

router.get('/:sessionId/results', authorize('admin', 'coordinator'), evaluations.getSessionResults);

export default router;
