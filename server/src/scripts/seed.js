/**
 * Creates a starter administrator plus a small demo set so the app is walkable
 * on first run. Safe to re-run: it upserts by email / registration number.
 *
 *   npm run seed
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Apprentice } from '../models/Apprentice.js';
import { EvaluationSession } from '../models/EvaluationSession.js';
import { Evaluation } from '../models/Evaluation.js';

const people = [
  { name: 'System Administrator', email: env.seedAdminEmail, role: 'admin', designation: 'ICT Division' },
  { name: 'Nadeeka Perera', email: 'coordinator@naita.lk', role: 'coordinator', designation: 'Evaluation Coordinator' },
  { name: 'Dr. Sunil Jayawardena', email: 'chief@naita.lk', role: 'chief_examiner', designation: 'Senior Lecturer' },
  { name: 'Ruwani Fernando', email: 'support@naita.lk', role: 'support_examiner', designation: 'Industry Assessor' },
];

const apprentices = [
  {
    registrationNumber: 'NA/2026/0142',
    name: 'Kasun Silva',
    course: 'Software Engineering',
    trainingCentre: 'Colombo District Training Centre',
    projectTitle: 'Smart irrigation controller for smallholder paddy fields',
  },
  {
    registrationNumber: 'NA/2026/0187',
    name: 'Thilini Bandara',
    course: 'Software Engineering',
    trainingCentre: 'Kandy District Training Centre',
    projectTitle: 'Offline-first attendance system for rural training centres',
  },
];

async function upsertUser(spec) {
  let user = await User.findOne({ email: spec.email });
  if (!user) {
    user = new User({ ...spec, mustChangePassword: true });
    await user.setPassword(env.seedAdminPassword);
    await user.save();
    console.log(`  created ${spec.role.padEnd(16)} ${spec.email}`);
  } else {
    console.log(`  exists  ${spec.role.padEnd(16)} ${spec.email}`);
  }
  return user;
}

async function main() {
  await connectDatabase();
  console.log('Seeding NAITA evaluation database...\n');

  const created = {};
  for (const spec of people) {
    created[spec.role] = await upsertUser(spec);
  }

  for (const spec of apprentices) {
    const existing = await Apprentice.findOne({ registrationNumber: spec.registrationNumber });
    if (!existing) {
      await Apprentice.create(spec);
      console.log(`  created apprentice      ${spec.registrationNumber}`);
    }
  }

  const firstApprentice = await Apprentice.findOne({ registrationNumber: apprentices[0].registrationNumber });
  const existingSession = await EvaluationSession.findOne({ apprentice: firstApprentice._id });

  if (!existingSession) {
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
    const session = await EvaluationSession.create({
      apprentice: firstApprentice._id,
      chiefExaminer: created.chief_examiner._id,
      supportExaminer: created.support_examiner._id,
      coordinator: created.coordinator._id,
      venue: 'Auditorium B, NAITA Head Office',
      scheduledAt,
      durationMinutes: 45,
      notes: 'Demo session created by the seed script.',
    });
    await Evaluation.insertMany([
      { session: session._id, examiner: created.chief_examiner._id, slot: 'chief' },
      { session: session._id, examiner: created.support_examiner._id, slot: 'support' },
    ]);
    console.log(`  created demo session    ${scheduledAt.toISOString()}`);
  }

  console.log(`\nAll seeded accounts share the password in SEED_ADMIN_PASSWORD.`);
  console.log('Every account is flagged to change its password at first sign-in.\n');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
