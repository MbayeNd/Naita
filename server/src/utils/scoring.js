import { CRITERIA, BANDS, CRITERION_IDS } from '../config/rubric.js';

const WEIGHTS = Object.fromEntries(CRITERIA.map((c) => [c.id, c.weight]));

/** Round to 2 decimals without float drift (0.1 + 0.2 problems). */
export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Weighted total for one examiner (SRS FR9).
 * Each criterion is scored 0-100; total = sum(score x weight) / 100, itself on a 0-100 scale.
 */
export function calculateTotal(scores) {
  const byId = new Map(scores.map((s) => [s.criterionId, s.score]));
  const total = CRITERIA.reduce((sum, c) => sum + (byId.get(c.id) ?? 0) * c.weight, 0) / 100;
  return round2(total);
}

/** Every criterion must be scored before submission (Business Rule 6). */
export function findMissingCriteria(scores) {
  const scored = new Set(
    scores.filter((s) => typeof s.score === 'number' && !Number.isNaN(s.score)).map((s) => s.criterionId)
  );
  return CRITERION_IDS.filter((id) => !scored.has(id));
}

/** Final apprentice mark (SRS FR10 / Business Rule 5): mean of both examiner totals. */
export function calculateFinalMark(chiefTotal, supportTotal) {
  if (typeof chiefTotal !== 'number' || typeof supportTotal !== 'number') return null;
  return round2((chiefTotal + supportTotal) / 2);
}

export function bandForScore(score) {
  if (typeof score !== 'number') return null;
  return BANDS.find((b) => score >= b.min && score <= b.max)?.id ?? null;
}

export function isValidCriterionId(id) {
  return Object.prototype.hasOwnProperty.call(WEIGHTS, id);
}
