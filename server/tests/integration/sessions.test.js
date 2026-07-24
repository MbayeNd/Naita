import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDatabase } from "./helpers/testServer.js";

let app;
let User;
let Apprentice;

before(async () => {
  await startTestDb();
  ({ default: app } = await import("../../src/app.js"));
  ({ User } = await import("../../src/models/User.js"));
  ({ Apprentice } = await import("../../src/models/Apprentice.js"));
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

async function seedScenario() {
  const coordinator = await createUser({ email: "coord@test.com", password: "Password123!", role: "coordinator", name: "Coordinator" });
  const chief = await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief Examiner" });
  const support = await createUser({ email: "support@test.com", password: "Password123!", role: "support_examiner", name: "Support Examiner" });
  const outsider = await createUser({ email: "outsider@test.com", password: "Password123!", role: "chief_examiner", name: "Outsider Examiner" });
  const apprentice = await Apprentice.create({
    registrationNumber: "NA/2026/TEST1",
    name: "Test Apprentice",
  });
  return { coordinator, chief, support, outsider, apprentice };
}

describe("POST /api/sessions", () => {
  test("a coordinator can schedule a session", async () => {
    const { chief, support, apprentice } = await seedScenario();
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        apprentice: apprentice._id.toString(),
        chiefExaminer: chief._id.toString(),
        supportExaminer: support._id.toString(),
        venue: "Room 1",
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 45,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.session.apprentice.name, "Test Apprentice");
  });

  test("an examiner cannot schedule a session", async () => {
    const { chief, support, apprentice } = await seedScenario();
    const token = await loginAs("chief@test.com", "Password123!");

    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        apprentice: apprentice._id.toString(),
        chiefExaminer: chief._id.toString(),
        supportExaminer: support._id.toString(),
        venue: "Room 1",
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 45,
      });

    assert.equal(res.status, 403);
  });

  test("rejects the same person as both chief and support examiner", async () => {
    const { chief, apprentice } = await seedScenario();
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        apprentice: apprentice._id.toString(),
        chiefExaminer: chief._id.toString(),
        supportExaminer: chief._id.toString(),
        venue: "Room 1",
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 45,
      });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/sessions/:id", () => {
  test("an assigned examiner can view the session", async () => {
    const { chief, support, apprentice } = await seedScenario();
    const coordToken = await loginAs("coord@test.com", "Password123!");

    const created = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${coordToken}`)
      .send({
        apprentice: apprentice._id.toString(),
        chiefExaminer: chief._id.toString(),
        supportExaminer: support._id.toString(),
        venue: "Room 1",
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 45,
      });

    const chiefToken = await loginAs("chief@test.com", "Password123!");
    const res = await request(app)
      .get(`/api/sessions/${created.body.session.id}`)
      .set("Authorization", `Bearer ${chiefToken}`);

    assert.equal(res.status, 200);
  });

  test("an examiner not assigned to the session is forbidden", async () => {
    const { chief, support, apprentice } = await seedScenario();
    const coordToken = await loginAs("coord@test.com", "Password123!");

    const created = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${coordToken}`)
      .send({
        apprentice: apprentice._id.toString(),
        chiefExaminer: chief._id.toString(),
        supportExaminer: support._id.toString(),
        venue: "Room 1",
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 45,
      });

    const outsiderToken = await loginAs("outsider@test.com", "Password123!");
    const res = await request(app)
      .get(`/api/sessions/${created.body.session.id}`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    assert.equal(res.status, 403);
  });
});