import { test, describe } from "node:test";
import assert from "node:assert/strict";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/naita_test";
process.env.JWT_SECRET ??= "test-secret-not-used-for-signing-anything-real";

const { saveScoresSchema, reopenSchema } = await import("../src/controllers/evaluationController.js");
const { createSessionSchema } = await import("../src/controllers/sessionController.js");
const { createUserSchema } = await import("../src/controllers/userController.js");
const { loginSchema, passwordSchema } = await import("../src/controllers/authController.js");

const ok = (schema, value) => schema.safeParse(value).success;

describe("marking sheet input", () => {
  test("accepts a score against a real criterion", () => {
    assert.ok(ok(saveScoresSchema, { scores: [{ criterionId: "development", score: 88 }] }));
  });

  test("accepts null for a criterion not yet scored", () => {
    assert.ok(ok(saveScoresSchema, { scores: [{ criterionId: "development", score: null }] }));
  });

  test("rejects an unknown criterion id", () => {
    assert.ok(!ok(saveScoresSchema, { scores: [{ criterionId: "made_up", score: 50 }] }));
  });

  test("rejects marks outside 0-100", () => {
    assert.ok(!ok(saveScoresSchema, { scores: [{ criterionId: "development", score: 101 }] }));
    assert.ok(!ok(saveScoresSchema, { scores: [{ criterionId: "development", score: -1 }] }));
  });
});

describe("reopening a submitted sheet (BR3)", () => {
  test("requires a substantive reason", () => {
    assert.ok(!ok(reopenSchema, { reason: "" }));
    assert.ok(!ok(reopenSchema, { reason: "oops" }));
    assert.ok(ok(reopenSchema, { reason: "Transcription error on criterion 5" }));
  });
});

describe("scheduling input (FR4)", () => {
  const base = {
    apprentice: "507f1f77bcf86cd799439011",
    chiefExaminer: "507f1f77bcf86cd799439012",
    supportExaminer: "507f1f77bcf86cd799439013",
    venue: "Auditorium B",
    scheduledAt: "2026-08-01T09:00:00.000Z",
    durationMinutes: 45,
  };

  test("accepts a complete booking", () => {
    assert.ok(ok(createSessionSchema, base));
  });

  test("coerces a duration submitted as a string", () => {
    const parsed = createSessionSchema.parse({ ...base, durationMinutes: "45" });
    assert.equal(parsed.durationMinutes, 45);
    assert.ok(parsed.scheduledAt instanceof Date);
  });

  test("rejects malformed identifiers", () => {
    assert.ok(!ok(createSessionSchema, { ...base, apprentice: "abc" }));
  });

  test("holds the duration inside the allowed range", () => {
    assert.ok(!ok(createSessionSchema, { ...base, durationMinutes: 4 }));
    assert.ok(!ok(createSessionSchema, { ...base, durationMinutes: 241 }));
  });
});

describe("password rules", () => {
  const account = { name: "Nimal Perera", email: "nimal@naita.lk", role: "coordinator" };

  test("rejects weak passwords", () => {
    for (const password of ["short", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"]) {
      assert.ok(!ok(createUserSchema, { ...account, password }), `${password} should be rejected`);
    }
  });

  test("accepts a password meeting every rule", () => {
    assert.ok(ok(createUserSchema, { ...account, password: "Passw0rdLong" }));
  });

  test("applies the same rules on self-service change", () => {
    assert.ok(!ok(passwordSchema, { currentPassword: "x", newPassword: "weak" }));
    assert.ok(ok(passwordSchema, { currentPassword: "x", newPassword: "Passw0rdLong" }));
  });

  test("rejects an unknown role", () => {
    assert.ok(!ok(createUserSchema, { ...account, role: "principal", password: "Passw0rdLong" }));
  });
});

describe("sign in", () => {
  test("normalises the email to lowercase", () => {
    assert.equal(loginSchema.parse({ email: "  ADMIN@NAITA.LK ", password: "x" }).email, "admin@naita.lk");
  });

  test("rejects a malformed email", () => {
    assert.ok(!ok(loginSchema, { email: "not-an-email", password: "x" }));
  });
});