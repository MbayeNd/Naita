import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import apprenticeRoutes from './apprenticeRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import evaluationRoutes from './evaluationRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/apprentices', apprenticeRoutes);
router.use('/sessions', sessionRoutes);
router.use('/evaluations', evaluationRoutes);

export default router;
