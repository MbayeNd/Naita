import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CRITERIA, BANDS, DESCRIPTORS, getRubric } from "../src/config/rubric.js";

describe("rubric integrity (FR7)", () => {
  test("weights total 100", () => {
    assert.equal(CRITERIA.reduce((sum, c) => sum + c.weight, 0), 100);
  });

  test("has the ten criteria the SRS specifies, in order", () => {
    assert.equal(CRITERIA.length, 10);
    CRITERIA.forEach((c, i) => assert.equal(c.order, i + 1));
  });

  test("criterion ids are unique", () => {
    assert.equal(new Set(CRITERIA.map((c) => c.id)).size, CRITERIA.length);
  });

  test("every criterion has a descriptor for every band", () => {
    for (const criterion of CRITERIA) {
      const descriptors = DESCRIPTORS[criterion.id];
      assert.ok(descriptors, `${criterion.id} has no descriptors`);
      for (const band of BANDS) {
        assert.ok(descriptors[band.id]?.length > 0, `${criterion.id} is missing the ${band.id} descriptor`);
      }
    }
  });

  test("bands tile 0-100 with no overlap and no gap", () => {
    const sorted = [...BANDS].sort((a, b) => a.min - b.min);
    assert.equal(sorted[0].min, 0);
    assert.equal(sorted.at(-1).max, 100);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.equal(sorted[i].min, sorted[i - 1].max + 1, `gap or overlap around ${sorted[i].id}`);
    }
  });

  test("each band suggestion sits inside its own range", () => {
    for (const band of BANDS) {
      assert.ok(band.suggested >= band.min && band.suggested <= band.max, `${band.id} suggestion is out of range`);
    }
  });

  test("getRubric ships descriptors to the client", () => {
    const rubric = getRubric();
    assert.equal(rubric.criteria.length, 10);
    assert.ok(rubric.criteria[0].descriptors.excellent);
    assert.equal(rubric.bands.length, 5);
  });
});