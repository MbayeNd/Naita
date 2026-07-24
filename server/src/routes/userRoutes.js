import { Router } from 'express';
import * as users from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

// Coordinators need the examiner list to fill the scheduling form.
router.get('/examiners', authorize('admin', 'coordinator'), users.listExaminers);

router.use(authorize('admin'));
router.get('/', users.listUsers);
router.post('/', validate(users.createUserSchema), users.createUser);
router.patch('/:id', validate(users.updateUserSchema), users.updateUser);
router.patch('/:id/password', validate(users.resetPasswordSchema), users.resetPassword);
router.delete('/:id', users.deleteUser);

export default router;
