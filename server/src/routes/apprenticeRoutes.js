import { Router } from 'express';
import * as apprentices from '../controllers/apprenticeController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

router.get('/', apprentices.listApprentices);
router.post('/', authorize('admin', 'coordinator'), validate(apprentices.apprenticeSchema), apprentices.createApprentice);
router.patch('/:id', authorize('admin', 'coordinator'), validate(apprentices.apprenticeSchema.partial()), apprentices.updateApprentice);
router.delete('/:id', authorize('admin'), apprentices.deleteApprentice);

export default router;
