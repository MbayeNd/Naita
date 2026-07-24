import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDatabase } from "./helpers/testServer.js";

let app;
let User;
let Apprentice;
let EvaluationSession;
let Evaluation;
let CRITERIA;

before(async () => {
  await startTestDb();
  ({ default: app } = await import("../../src/app.js"));
  ({ User } = await import("../../src/models/User.js"));
  ({ Apprentice } = await import("../../src/models/Apprentice.js"));
  ({ EvaluationSession } = await import("../../src/models/EvaluationSession.js"));
  ({ Evaluation } = await import("../../src/models/Evaluation.js"));
  ({ CRITERIA } = await import("../../src/config/rubric.js"));
});

after(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearDatabase();
});

async function createUser({ email, password, role, name }) {
  const user = new User({ name, email, role });
  await user.setPassword(password);
  await user.save();
  return user;
}

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

/** Builds a fresh coordinator + two examiners + apprentice + a live session with two draft evaluations. */
async function seedSession() {
  const coordinator = await createUser({ email: "coord@test.com", password: "Password123!", role: "coordinator", name: "Coordinator" });
  const chief = await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief Examiner" });
  const support = await createUser({ email: "support@test.com", password: "Password123!", role: "support_examiner", name: "Support Examiner" });
  const apprentice = await Apprentice.create({ registrationNumber: "NA/2026/E1", name: "Eval Apprentice" });

  const session = await EvaluationSession.create({
    apprentice: apprentice._id,
    chiefExaminer: chief._id,
    supportExaminer: support._id,
    coordinator: coordinator._id,
    venue: "Room 1",
    scheduledAt: new Date(),
    durationMinutes: 45,
  });

  await Evaluation.insertMany([
    { session: session._id, examiner: chief._id, slot: "chief" },
    { session: session._id, examiner: support._id, slot: "support" },
  ]);

  return { coordinator, chief, support, apprentice, session };
}

const fullScores = () => CRITERIA.map((c) => ({ criterionId: c.id, score: 80 }));

describe("GET /api/evaluations/rubric", () => {
  test("is publicly accessible without a token", async () => {
    const res = await request(app).get("/api/evaluations/rubric");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.criteria));
  });
});

describe("PUT /api/sessions/:sessionId/my-evaluation", () => {
  test("an assigned examiner can save a draft with partial scores", async () => {
    const { session } = await seedSession();
    const token = await loginAs("chief@test.com", "Password123!");

    const res = await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: [{ criterionId: CRITERIA[0].id, score: 70 }], generalComment: "Good start." });

    assert.equal(res.status, 200);
    assert.equal(res.body.evaluation.status, "draft");
  });

  test("an examiner not assigned to the session is forbidden", async () => {
    const { session } = await seedSession();
    const outsider = await createUser({ email: "outsider@test.com", password: "Password123!", role: "chief_examiner", name: "Outsider" });
    const token = await loginAs("outsider@test.com", "Password123!");

    const res = await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: fullScores() });

    assert.equal(res.status, 403);
  });

  test("a coordinator cannot save marks", async () => {
    const { session } = await seedSession();
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: fullScores() });

    assert.equal(res.status, 403);
  });
});

describe("POST /api/sessions/:sessionId/my-evaluation/submit", () => {
  test("rejects submission when criteria are missing", async () => {
    const { session } = await seedSession();
    const token = await loginAs("chief@test.com", "Password123!");

    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: [{ criterionId: CRITERIA[0].id, score: 70 }] });

    const res = await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 400);
  });

  test("submits successfully once every criterion is scored", async () => {
    const { session } = await seedSession();
    const token = await loginAs("chief@test.com", "Password123!");

    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: fullScores() });

    const res = await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.evaluation.status, "submitted");
    // Only one of two examiners has submitted so far — no final mark yet.
    assert.equal(res.body.finalMark, null);
  });

  test("computes the final mark once both examiners have submitted", async () => {
    const { session } = await seedSession();
    const chiefToken = await loginAs("chief@test.com", "Password123!");
    const supportToken = await loginAs("support@test.com", "Password123!");

    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${chiefToken}`)
      .send({ scores: fullScores() });
    await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${chiefToken}`);

    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${supportToken}`)
      .send({ scores: fullScores() });
    const res = await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${supportToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.finalMark, 80);
    assert.equal(res.body.sessionStatus, "completed");
  });

  test("rejects a second submission from the same examiner", async () => {
    const { session } = await seedSession();
    const token = await loginAs("chief@test.com", "Password123!");

    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: fullScores() });
    await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 409);
  });
});

describe("GET /api/sessions/:sessionId/results", () => {
  test("a coordinator can view combined results", async () => {
    const { session } = await seedSession();
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .get(`/api/sessions/${session._id}/results`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok("chief" in res.body);
    assert.ok("support" in res.body);
  });

  test("an examiner cannot view the combined results endpoint", async () => {
    const { session } = await seedSession();
    const token = await loginAs("chief@test.com", "Password123!");

    const res = await request(app)
      .get(`/api/sessions/${session._id}/results`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 403);
  });
});

describe("POST /api/evaluations/:id/reopen", () => {
  test("an admin can reopen a submitted evaluation with a reason", async () => {
    const { session, chief } = await seedSession();
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });

    const chiefToken = await loginAs("chief@test.com", "Password123!");
    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${chiefToken}`)
      .send({ scores: fullScores() });
    await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${chiefToken}`);

    const evaluation = await Evaluation.findOne({ session: session._id, examiner: chief._id });
    const adminToken = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .post(`/api/evaluations/${evaluation._id}/reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Examiner reported a scoring mistake." });

    assert.equal(res.status, 200);
    assert.equal(res.body.evaluation.status, "draft");
  });

  test("a coordinator cannot reopen an evaluation", async () => {
    const { session, chief } = await seedSession();
    const chiefToken = await loginAs("chief@test.com", "Password123!");
    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${chiefToken}`)
      .send({ scores: fullScores() });
    await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${chiefToken}`);

    const evaluation = await Evaluation.findOne({ session: session._id, examiner: chief._id });
    const coordToken = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .post(`/api/evaluations/${evaluation._id}/reopen`)
      .set("Authorization", `Bearer ${coordToken}`)
      .send({ reason: "Trying to reopen without permission." });

    assert.equal(res.status, 403);
  });

  test("rejects a reopen request with too short a reason", async () => {
    const { session, chief } = await seedSession();
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });

    const chiefToken = await loginAs("chief@test.com", "Password123!");
    await request(app)
      .put(`/api/sessions/${session._id}/my-evaluation`)
      .set("Authorization", `Bearer ${chiefToken}`)
      .send({ scores: fullScores() });
    await request(app)
      .post(`/api/sessions/${session._id}/my-evaluation/submit`)
      .set("Authorization", `Bearer ${chiefToken}`);

    const evaluation = await Evaluation.findOne({ session: session._id, examiner: chief._id });
    const adminToken = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .post(`/api/evaluations/${evaluation._id}/reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "hi" });

    assert.equal(res.status, 400);
  });
});