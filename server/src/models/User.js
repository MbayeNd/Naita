import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'coordinator', 'chief_examiner', 'support_examiner'];
export const EXAMINER_ROLES = ['chief_examiner', 'support_examiner'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address.'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    contactNumber: { type: String, trim: true, maxlength: 32 },
    designation: { type: String, trim: true, maxlength: 120 },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    contactNumber: this.contactNumber ?? '',
    designation: this.designation ?? '',
    isActive: this.isActive,
    mustChangePassword: this.mustChangePassword,
    lastLoginAt: this.lastLoginAt ?? null,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
