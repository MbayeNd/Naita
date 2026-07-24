/**
 * Fixed assessment rubric (SRS FR7).
 * Weights are percentages and must total 100.
 * `id` values are persisted on Evaluation documents — do not rename them.
 * Editing this file changes the rubric for future evaluations only; historical
 * evaluations keep the snapshot stored on their own document.
 */
export const RUBRIC_VERSION = '1.0';

export const CRITERIA = [
  { id: 'problem_identification', order: 1, title: 'Problem Identification & Innovation', weight: 10 },
  { id: 'background_study', order: 2, title: 'Background Study', weight: 10 },
  { id: 'technical_knowledge', order: 3, title: 'Technical / Domain Knowledge', weight: 10 },
  { id: 'design_methodology', order: 4, title: 'Design & Methodology', weight: 15 },
  { id: 'development', order: 5, title: 'Development & Implementation', weight: 20 },
  { id: 'testing_evaluation', order: 6, title: 'Testing & Evaluation', weight: 10 },
  { id: 'project_management', order: 7, title: 'Project Planning & Management', weight: 5 },
  { id: 'ethics_sustainability', order: 8, title: 'Ethical, Social & Sustainability Considerations', weight: 5 },
  { id: 'final_report', order: 9, title: 'Final Report', weight: 10 },
  { id: 'presentation', order: 10, title: 'Presentation & Demonstration', weight: 5 },
];

export const BANDS = [
  { id: 'excellent', label: 'Excellent', min: 85, max: 100, suggested: 92 },
  { id: 'very_good', label: 'Very Good', min: 70, max: 84, suggested: 77 },
  { id: 'good', label: 'Good', min: 55, max: 69, suggested: 62 },
  { id: 'average', label: 'Average', min: 45, max: 54, suggested: 50 },
  { id: 'below_average', label: 'Below Average', min: 0, max: 44, suggested: 30 },
];

/** Band descriptors shown to examiners, keyed by criterion id then band id. */
export const DESCRIPTORS = {
  problem_identification: {
    excellent: 'Problem is well defined with clear objectives; highly innovative solution addressing a real need.',
    very_good: 'Problem and objectives are clear; solution demonstrates innovation.',
    good: 'Problem is identified; objectives are mostly clear; some originality.',
    average: 'Problem statement lacks clarity; limited innovation.',
    below_average: 'Problem unclear; objectives missing or no evidence of innovation.',
  },
  background_study: {
    excellent: 'Comprehensive review (10+ quality sources); strong synthesis identifying research gap.',
    very_good: 'Good review (8-10 sources); knowledge gap clearly discussed.',
    good: 'Adequate review (5-7 sources); some discussion of existing work.',
    average: 'Limited literature review with weak analysis.',
    below_average: 'Little or no literature review.',
  },
  technical_knowledge: {
    excellent: 'Demonstrates expert understanding and justifies all technical decisions.',
    very_good: 'Strong understanding with good justification.',
    good: 'Adequate understanding of the domain.',
    average: 'Limited understanding with weak justification.',
    below_average: 'Poor understanding of the subject area.',
  },
  design_methodology: {
    excellent: 'Well-structured architecture, methodology fully justified, professional documentation.',
    very_good: 'Design is clear and mostly complete.',
    good: 'Design meets minimum requirements.',
    average: 'Design lacks detail or consistency.',
    below_average: 'Design is incomplete or incorrect.',
  },
  development: {
    excellent: 'Solution fully implemented with advanced features and excellent quality.',
    very_good: 'Most planned features implemented successfully.',
    good: 'Core features implemented and functional.',
    average: 'Partial implementation with several missing features.',
    below_average: 'Little or no implementation completed.',
  },
  testing_evaluation: {
    excellent: 'Comprehensive testing with meaningful evaluation and performance analysis.',
    very_good: 'Good testing with appropriate evaluation.',
    good: 'Basic testing completed.',
    average: 'Limited testing with minimal evaluation.',
    below_average: 'Testing not demonstrated.',
  },
  project_management: {
    excellent: 'Excellent planning with milestones, risk management, and progress tracking.',
    very_good: 'Good planning and monitoring.',
    good: 'Adequate project planning.',
    average: 'Limited planning evidence.',
    below_average: 'No planning or documentation.',
  },
  ethics_sustainability: {
    excellent: 'Thorough discussion of ethics, security, legal, and societal impacts.',
    very_good: 'Covers most relevant issues.',
    good: 'Covers some considerations.',
    average: 'Mentions only a few issues.',
    below_average: 'No consideration of these aspects.',
  },
  final_report: {
    excellent: 'Professional report with excellent structure, referencing, and academic writing.',
    very_good: 'Well-written report with minor issues.',
    good: 'Satisfactory report.',
    average: 'Weak organization and language.',
    below_average: 'Poorly written or incomplete report.',
  },
  presentation: {
    excellent: 'Confident presentation; live demonstration fully successful; answers questions expertly.',
    very_good: 'Good presentation with successful demonstration.',
    good: 'Adequate presentation and demonstration.',
    average: 'Weak presentation or incomplete demonstration.',
    below_average: 'Unable to effectively present or demonstrate.',
  },
};

export const CRITERION_IDS = CRITERIA.map((c) => c.id);

export function getRubric() {
  return {
    version: RUBRIC_VERSION,
    criteria: CRITERIA.map((c) => ({ ...c, descriptors: DESCRIPTORS[c.id] })),
    bands: BANDS,
  };
}

// Fail fast at boot rather than producing silently wrong totals.
const totalWeight = CRITERIA.reduce((sum, c) => sum + c.weight, 0);
if (totalWeight !== 100) {
  throw new Error(`Rubric weights must total 100, got ${totalWeight}`);
}
