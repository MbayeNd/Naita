import { Router } from 'express';
import * as evaluations from '../controllers/evaluationController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/rubric', evaluations.rubric);

router.use(authenticate);
router.get('/results', evaluations.listResults);
router.post('/:id/reopen', authorize('admin'), validate(evaluations.reopenSchema), evaluations.reopenEvaluation);
router.get('/audit', authorize('admin'), evaluations.listAudit);

export default router;
