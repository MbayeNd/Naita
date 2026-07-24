import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDatabase } from "./helpers/testServer.js";

let app;
let User;
let Apprentice;
let EvaluationSession;

before(async () => {
  await startTestDb();
  ({ default: app } = await import("../../src/app.js"));
  ({ User } = await import("../../src/models/User.js"));
  ({ Apprentice } = await import("../../src/models/Apprentice.js"));
  ({ EvaluationSession } = await import("../../src/models/EvaluationSession.js"));
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

describe("GET /api/apprentices", () => {
  test("any authenticated user can list apprentices", async () => {
    await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    await Apprentice.create({ registrationNumber: "NA/2026/A1", name: "Apprentice One" });

    const token = await loginAs("chief@test.com", "Password123!");
    const res = await request(app).get("/api/apprentices").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.apprentices.length, 1);
  });

  test("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/apprentices");
    assert.equal(res.status, 401);
  });
});

describe("POST /api/apprentices", () => {
  test("a coordinator can create an apprentice", async () => {
    await createUser({ email: "coord@test.com", password: "Password123!", role: "coordinator", name: "Coord" });
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .post("/api/apprentices")
      .set("Authorization", `Bearer ${token}`)
      .send({ registrationNumber: "NA/2026/A2", name: "New Apprentice" });

    assert.equal(res.status, 201);
    assert.equal(res.body.apprentice.name, "New Apprentice");
  });

  test("an examiner cannot create an apprentice", async () => {
    await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const token = await loginAs("chief@test.com", "Password123!");

    const res = await request(app)
      .post("/api/apprentices")
      .set("Authorization", `Bearer ${token}`)
      .send({ registrationNumber: "NA/2026/A3", name: "Blocked Apprentice" });

    assert.equal(res.status, 403);
  });
});

describe("DELETE /api/apprentices/:id", () => {
  test("an admin can delete an apprentice with no session history", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const apprentice = await Apprentice.create({ registrationNumber: "NA/2026/A4", name: "Deletable" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .delete(`/api/apprentices/${apprentice._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
  });

  test("a coordinator cannot delete an apprentice", async () => {
    await createUser({ email: "coord@test.com", password: "Password123!", role: "coordinator", name: "Coord" });
    const apprentice = await Apprentice.create({ registrationNumber: "NA/2026/A5", name: "Protected" });
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app)
      .delete(`/api/apprentices/${apprentice._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 403);
  });

  test("refuses to delete an apprentice with linked sessions", async () => {
    const admin = await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const chief = await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const support = await createUser({ email: "support@test.com", password: "Password123!", role: "support_examiner", name: "Support" });
    const apprentice = await Apprentice.create({ registrationNumber: "NA/2026/A6", name: "Has History" });

    await EvaluationSession.create({
      apprentice: apprentice._id,
      chiefExaminer: chief._id,
      supportExaminer: support._id,
      coordinator: admin._id,
      venue: "Room 1",
      scheduledAt: new Date(),
      durationMinutes: 45,
    });

    const token = await loginAs("admin@test.com", "Password123!");
    const res = await request(app)
      .delete(`/api/apprentices/${apprentice._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 409);
  });
});