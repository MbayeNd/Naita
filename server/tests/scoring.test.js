import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTotal,
  calculateFinalMark,
  findMissingCriteria,
  bandForScore,
  round2,
} from "../src/utils/scoring.js";
import { CRITERIA, CRITERION_IDS } from "../src/config/rubric.js";

const scoreAll = (value) => CRITERIA.map((c) => ({ criterionId: c.id, score: value }));

describe("calculateTotal (FR9)", () => {
  test("a uniform score returns that same score", () => {
    assert.equal(calculateTotal(scoreAll(80)), 80);
    assert.equal(calculateTotal(scoreAll(100)), 100);
    assert.equal(calculateTotal(scoreAll(0)), 0);
  });

  test("each criterion contributes exactly its weight", () => {
    for (const criterion of CRITERIA) {
      const scores = CRITERIA.map((c) => ({ criterionId: c.id, score: c.id === criterion.id ? 100 : 0 }));
      assert.equal(calculateTotal(scores), criterion.weight, `${criterion.id} should contribute ${criterion.weight}`);
    }
  });

  test("unscored criteria count as zero rather than being skipped", () => {
    // Development is worth 20%. Scoring only that, at 100, must not yield 100.
    const partial = [{ criterionId: "development", score: 100 }];
    assert.equal(calculateTotal(partial), 20);
  });

  test("ignores criterion ids that are not in the rubric", () => {
    const withJunk = [...scoreAll(50), { criterionId: "not_a_criterion", score: 100 }];
    assert.equal(calculateTotal(withJunk), 50);
  });

  test("rounds to two decimals without float drift", () => {
    const total = calculateTotal(CRITERIA.map((c) => ({ criterionId: c.id, score: 77.7 })));
    assert.equal(total, 77.7);
    assert.equal(round2(0.1 + 0.2), 0.3);
  });
});

describe("calculateFinalMark (FR10 / BR5)", () => {
  test("averages the two examiner totals", () => {
    assert.equal(calculateFinalMark(72.5, 68), 70.25);
    assert.equal(calculateFinalMark(90, 90), 90);
  });

  test("returns null unless both totals are present", () => {
    assert.equal(calculateFinalMark(72.5, null), null);
    assert.equal(calculateFinalMark(null, 68), null);
    assert.equal(calculateFinalMark(undefined, undefined), null);
  });

  test("treats a zero total as a real value, not a missing one", () => {
    assert.equal(calculateFinalMark(0, 50), 25);
  });
});

describe("findMissingCriteria (BR6)", () => {
  test("reports nothing missing when every criterion is scored", () => {
    assert.deepEqual(findMissingCriteria(scoreAll(60)), []);
  });

  test("counts a null score as unscored", () => {
    const scores = scoreAll(60).map((s, i) => (i === 3 ? { ...s, score: null } : s));
    assert.deepEqual(findMissingCriteria(scores), [CRITERION_IDS[3]]);
  });

  test("counts zero as scored", () => {
    const scores = scoreAll(60).map((s, i) => (i === 0 ? { ...s, score: 0 } : s));
    assert.deepEqual(findMissingCriteria(scores), []);
  });

  test("an empty sheet is missing every criterion", () => {
    assert.equal(findMissingCriteria([]).length, CRITERION_IDS.length);
  });
});

describe("bandForScore", () => {
  test("maps marks onto the rubric bands", () => {
    assert.equal(bandForScore(92), "excellent");
    assert.equal(bandForScore(85), "excellent");
    assert.equal(bandForScore(84), "very_good");
    assert.equal(bandForScore(70), "very_good");
    assert.equal(bandForScore(69), "good");
    assert.equal(bandForScore(55), "good");
    assert.equal(bandForScore(54), "average");
    assert.equal(bandForScore(45), "average");
    assert.equal(bandForScore(44), "below_average");
    assert.equal(bandForScore(0), "below_average");
  });

  test("leaves no gap between bands", () => {
    for (let mark = 0; mark <= 100; mark += 1) {
      assert.ok(bandForScore(mark), `mark ${mark} fell outside every band`);
    }
  });
});