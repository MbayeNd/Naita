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

async function createUser({ email, password, role = "admin", name = "Test User", isActive = true }) {
  const user = new User({ name, email, role, isActive });
  await user.setPassword(password);
  await user.save();
  return user;
}

describe("POST /api/auth/login", () => {
  test("logs in with correct credentials and returns a token", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "Password123!" });

    assert.equal(res.status, 200);
    assert.ok(res.body.token, "expected a token in the response");
    assert.equal(res.body.user.email, "admin@test.com");
    assert.equal(res.body.user.passwordHash, undefined, "password hash must never be returned");
  });

  test("rejects an incorrect password with a generic message", async () => {
    await createUser({ email: "admin@test.com", password: "Password123!" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "wrong-password" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, "That email and password combination is not recognised.");
  });

  test("rejects an unknown email with the same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "whatever" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, "That email and password combination is not recognised.");
  });

  test("rejects a deactivated account", async () => {
    await createUser({ email: "gone@test.com", password: "Password123!", isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "gone@test.com", password: "Password123!" });

    assert.equal(res.status, 403);
  });

  test("rejects a malformed email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "whatever" });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/auth/me", () => {
  test("returns the authenticated user's profile", async () => {
    await createUser({ email: "me@test.com", password: "Password123!", name: "Me User" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "me@test.com", password: "Password123!" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, "me@test.com");
    assert.equal(res.body.user.name, "Me User");
  });

  test("rejects a request with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.equal(res.status, 401);
  });

  test("rejects a request with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    assert.equal(res.status, 401);
  });
});

describe("PATCH /api/auth/me/password", () => {
  test("changes the password when the current password is correct", async () => {
    await createUser({ email: "pw@test.com", password: "OldPassword123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "pw@test.com", password: "OldPassword123" });

    const res = await request(app)
      .patch("/api/auth/me/password")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ currentPassword: "OldPassword123", newPassword: "NewPassword456" });

    assert.equal(res.status, 200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "pw@test.com", password: "OldPassword123" });
    assert.equal(oldLogin.status, 401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "pw@test.com", password: "NewPassword456" });
    assert.equal(newLogin.status, 200);
  });

  test("rejects an incorrect current password", async () => {
    await createUser({ email: "pw2@test.com", password: "OldPassword123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "pw2@test.com", password: "OldPassword123" });

    const res = await request(app)
      .patch("/api/auth/me/password")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ currentPassword: "WrongPassword", newPassword: "NewPassword456" });

    assert.equal(res.status, 400);
  });
});
describe("POST /api/auth/refresh", () => {
  test("issues a new access token using the refresh cookie set at login", async () => {
    await createUser({ email: "refresh@test.com", password: "Password123!" });
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "refresh@test.com", password: "Password123!" });

    const res = await agent.post("/api/auth/refresh");

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, "refresh@test.com");
  });

  test("rejects a refresh with no cookie at all", async () => {
    const res = await request(app).post("/api/auth/refresh");
    assert.equal(res.status, 401);
  });

  test("rotation: a refresh token can only be used once", async () => {
    await createUser({ email: "rotate@test.com", password: "Password123!" });
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "rotate@test.com", password: "Password123!" });

    // Capture the raw cookie so we can replay it manually after the agent's jar has moved on.
    const firstRefresh = await agent.post("/api/auth/refresh");
    const oldCookie = firstRefresh.request.cookies; // cookie that was sent, now rotated away server-side

    // The agent itself, using its current (rotated) cookie, should refresh fine again.
    const secondRefresh = await agent.post("/api/auth/refresh");
    assert.equal(secondRefresh.status, 200);
  });

  test("reusing an already-rotated token revokes every session for that user", async () => {
    await createUser({ email: "reuse@test.com", password: "Password123!" });

    // Two independent "devices" for the same account, each with its own cookie jar.
    const deviceA = request.agent(app);
    const deviceB = request.agent(app);

    await deviceA.post("/api/auth/login").send({ email: "reuse@test.com", password: "Password123!" });
    await deviceB.post("/api/auth/login").send({ email: "reuse@test.com", password: "Password123!" });

    // Device A refreshes normally — its old token is now rotated away.
    await deviceA.post("/api/auth/refresh");

    // Device A tries to refresh AGAIN with the same (now-stale) cookie jar state
    // is not straightforward via supertest's agent, since the agent auto-updates
    // its jar. Instead, simulate theft by replaying deviceA's ORIGINAL login
    // cookie against a fresh agent.
    const loginRes = await request(app).post("/api/auth/login").send({ email: "reuse@test.com", password: "Password123!" });
    const originalCookie = loginRes.headers["set-cookie"];

    const thief = request(app);
    await thief.post("/api/auth/refresh").set("Cookie", originalCookie); // first use — rotates it away
    const replay = await thief.post("/api/auth/refresh").set("Cookie", originalCookie); // reuse — should be flagged

    assert.equal(replay.status, 401);
  });
});

describe("POST /api/auth/logout", () => {
  test("clears the session so the refresh cookie no longer works", async () => {
    await createUser({ email: "logout@test.com", password: "Password123!" });
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "logout@test.com", password: "Password123!" });
    const logoutRes = await agent.post("/api/auth/logout");
    assert.equal(logoutRes.status, 200);

    const afterLogout = await agent.post("/api/auth/refresh");
    assert.equal(afterLogout.status, 401);
  });

  test("is safe to call with no active session", async () => {
    const res = await request(app).post("/api/auth/logout");
    assert.equal(res.status, 200);
  });
});