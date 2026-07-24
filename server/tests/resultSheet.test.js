import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildResultSheet } from "../src/utils/resultSheet.js";
import { CRITERIA } from "../src/config/rubric.js";

/** Drains the PDFKit readable stream into a single Buffer for inspection. */
function collect(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function fullEvaluation(name, total) {
  return {
    examiner: { name },
    total,
    generalComment: "Solid work overall.",
    submittedAt: new Date("2026-08-01T10:15:00Z"),
    scores: CRITERIA.map((c) => ({ criterionId: c.id, score: 80 })),
  };
}

const baseSession = {
  apprentice: {
    name: "Kasun Silva",
    registrationNumber: "NA/2026/0142",
    course: "Software Engineering",
    trainingCentre: "Colombo District Training Centre",
    projectTitle: "Smart irrigation controller for smallholder paddy fields",
  },
  scheduledAt: new Date("2026-08-01T09:00:00Z"),
  completedAt: new Date("2026-08-01T10:20:00Z"),
  venue: "Auditorium B, NAITA Head Office",
  durationMinutes: 45,
  finalMark: 80,
  finalBand: "very_good",
};

describe("buildResultSheet (PDF export)", () => {
  test("produces a well-formed PDF for a fully submitted session", async () => {
    const chief = fullEvaluation("Dr. Sunil Jayawardena", 82.4);
    const support = fullEvaluation("Ruwani Fernando", 81.9);

    const buffer = await collect(buildResultSheet({ session: baseSession, chief, support }));

    assert.ok(buffer.length > 500, "expected a non-trivial PDF");
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    assert.equal(buffer.subarray(-6).toString().trim().endsWith("%%EOF"), true);
  });

  test("does not throw when optional fields are missing", async () => {
    const bareSession = {
      ...baseSession,
      apprentice: { name: "Thilini Bandara", registrationNumber: "NA/2026/0187" }, // no course, centre, or project title
      finalMark: null,
      finalBand: null,
    };
    const chief = { ...fullEvaluation("Dr. Sunil Jayawardena", 78), generalComment: "" };
    const support = null; // support examiner has not submitted yet

    const buffer = await collect(buildResultSheet({ session: bareSession, chief, support }));

    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  });

  test("renders correctly when neither examiner has submitted", async () => {
    const buffer = await collect(buildResultSheet({ session: { ...baseSession, finalMark: null, finalBand: null }, chief: null, support: null }));
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  });
});