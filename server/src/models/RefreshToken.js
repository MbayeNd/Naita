import mongoose from 'mongoose';

/**
 * Refresh tokens are opaque random strings, never JWTs — there is nothing to
 * decode, so the only way to use one is to present the exact value back to
 * the server. Only the SHA-256 hash is stored, mirroring how passwords are
 * handled: a database read alone is not enough to impersonate a session.
 *
 * Rotation: each use consumes the token and issues a new one. If a token
 * that was already rotated away is presented again, that is a signal the
 * token was copied (stolen) — see `revokedAt` + `replacedByHash` below.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },

    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Set when this token was consumed and rotated into a newer one — lets a
    // reuse attempt be told apart from "just expired".
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true }
);

// MongoDB deletes the document itself once expiresAt has passed; no cleanup job needed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);