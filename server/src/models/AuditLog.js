import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    action: { type: String, required: true, index: true },
    entityType: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditSchema);
