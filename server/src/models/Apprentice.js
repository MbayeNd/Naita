import mongoose from 'mongoose';

/**
 * The SRS names apprentices throughout but never defines them as a managed
 * record. They are modelled here as a first-class entity so sessions can
 * reference a stable identity and history can be reported per apprentice.
 */
const apprenticeSchema = new mongoose.Schema(
  {
    registrationNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true },
    contactNumber: { type: String, trim: true, maxlength: 32 },
    trainingCentre: { type: String, trim: true, maxlength: 160 },
    course: { type: String, trim: true, maxlength: 160 },
    projectTitle: { type: String, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

apprenticeSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    registrationNumber: this.registrationNumber,
    name: this.name,
    email: this.email ?? '',
    contactNumber: this.contactNumber ?? '',
    trainingCentre: this.trainingCentre ?? '',
    course: this.course ?? '',
    projectTitle: this.projectTitle ?? '',
    isActive: this.isActive,
  };
};

export const Apprentice = mongoose.model('Apprentice', apprenticeSchema);
