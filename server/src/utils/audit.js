import { AuditLog } from '../models/AuditLog.js';

/**
 * Records a privileged or state-changing action.
 * Deliberately swallows its own errors: a failed audit write must not roll back
 * the user's action, but it should be visible in the server log.
 */
export async function recordAudit({ actor, action, entityType, entityId, summary, metadata }) {
  try {
    await AuditLog.create({
      actor: actor?._id ?? actor,
      actorName: actor?.name,
      action,
      entityType,
      entityId,
      summary,
      metadata,
    });
  } catch (error) {
    console.error('[audit] failed to record %s:', action, error.message);
  }
}
