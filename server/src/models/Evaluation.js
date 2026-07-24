import mongoose from 'mongoose';
import { RUBRIC_VERSION } from '../config/rubric.js';

export const EVALUATION_STATUSES = ['draft', 'submitted'];
export const EXAMINER_SLOTS = ['chief', 'support'];

const scoreSchema = new mongoose.Schema(
  {
    criterionId: { type: String, required: true },
    score: { type: Number, min: 0, max: 100, default: null },
    band: { type: String, default: null },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationSession', required: true, index: true },
    examiner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slot: { type: String, enum: EXAMINER_SLOTS, required: true },

    rubricVersion: { type: String, default: RUBRIC_VERSION },
    scores: { type: [scoreSchema], default: [] },
    generalComment: { type: String, trim: true, maxlength: 2000 },

    total: { type: Number, default: null },
    status: { type: String, enum: EVALUATION_STATUSES, default: 'draft', index: true },
    submittedAt: { type: Date, default: null },

    // Business Rule 3: locked on submit; only an administrator can reopen.
    reopenCount: { type: Number, default: 0 },
    lastReopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastReopenedAt: { type: Date, default: null },
    lastReopenReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Business Rule 2: one submission per examiner per session.
evaluationSchema.index({ session: 1, examiner: 1 }, { unique: true });
evaluationSchema.index({ session: 1, slot: 1 }, { unique: true });

export const Evaluation = mongoose.model('Evaluation', evaluationSchema);
