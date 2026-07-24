import mongoose from 'mongoose';

export const SESSION_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

const sessionSchema = new mongoose.Schema(
  {
    apprentice: { type: mongoose.Schema.Types.ObjectId, ref: 'Apprentice', required: true, index: true },
    chiefExaminer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supportExaminer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    venue: { type: String, required: true, trim: true, maxlength: 160 },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 240 },
    notes: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: SESSION_STATUSES, default: 'scheduled', index: true },

    // Timer state (SRS FR6). Clients derive the countdown from these server values
    // rather than holding an open socket, so the deployment stays serverless-friendly.
    startedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    finalMark: { type: Number, default: null },
    finalBand: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Business Rule 1: exactly one chief and one support examiner, and they must differ.
sessionSchema.pre('validate', function enforceDistinctExaminers(next) {
  if (this.chiefExaminer && this.supportExaminer && String(this.chiefExaminer) === String(this.supportExaminer)) {
    return next(new Error('The chief examiner and support examiner must be two different people.'));
  }
  next();
});

sessionSchema.virtual('isRunning').get(function isRunning() {
  return this.status === 'in_progress' && this.endsAt instanceof Date && this.endsAt > new Date();
});

sessionSchema.index({ chiefExaminer: 1, scheduledAt: 1 });
sessionSchema.index({ supportExaminer: 1, scheduledAt: 1 });

export const EvaluationSession = mongoose.model('EvaluationSession', sessionSchema);
