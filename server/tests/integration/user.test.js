import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDatabase } from "./helpers/testServer.js";

let app;
let User;

before(async () => {
  await startTestDb();
  ({ default: app } = await import("../../src/app.js"));
  ({ User } = await import("../../src/models/User.js"));
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

describe("GET /api/users/examiners", () => {
  test("a coordinator can list examiners", async () => {
    await createUser({ email: "coord@test.com", password: "Password123!", role: "coordinator", name: "Coord" });
    await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app).get("/api/users/examiners").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 1);
  });

  test("an examiner cannot list examiners", async () => {
    await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const token = await loginAs("chief@test.com", "Password123!");

    const res = await request(app).get("/api/users/examiners").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 403);
  });
});

describe("GET /api/users", () => {
  test("an admin can list all users", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 2);
  });

  test("a coordinator cannot list all users", async () => {
    await createUser({ email: "coord@test.com", password: "Password123!", role: "coordinator", name: "Coord" });
    const token = await loginAs("coord@test.com", "Password123!");

    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 403);
  });
});

describe("POST /api/users", () => {
  test("an admin can create a new user", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "New Examiner",
        email: "newexaminer@test.com",
        role: "chief_examiner",
        password: "Password123!",
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.mustChangePassword, true);
  });

  test("rejects a duplicate email", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    await createUser({ email: "existing@test.com", password: "Password123!", role: "chief_examiner", name: "Existing" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Duplicate",
        email: "existing@test.com",
        role: "chief_examiner",
        password: "Password123!",
      });

    assert.equal(res.status, 409);
  });
});

describe("PATCH /api/users/:id", () => {
  test("an admin cannot deactivate their own account", async () => {
    const admin = await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .patch(`/api/users/${admin._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    assert.equal(res.status, 400);
  });

  test("an admin cannot change their own role", async () => {
    const admin = await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .patch(`/api/users/${admin._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "coordinator" });

    assert.equal(res.status, 400);
  });

  test("an admin can deactivate a different user", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const other = await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .patch(`/api/users/${other._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.isActive, false);
  });
});

describe("DELETE /api/users/:id", () => {
  test("an admin cannot delete their own account", async () => {
    const admin = await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .delete(`/api/users/${admin._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 400);
  });

  test("an admin can delete a user with no session history", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!", role: "admin", name: "Admin" });
    const other = await createUser({ email: "chief@test.com", password: "Password123!", role: "chief_examiner", name: "Chief" });
    const token = await loginAs("admin@test.com", "Password123!");

    const res = await request(app)
      .delete(`/api/users/${other._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
  });
});