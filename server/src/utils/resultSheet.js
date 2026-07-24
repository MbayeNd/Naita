import PDFDocument from "pdfkit";
import { CRITERIA, BANDS } from "../config/rubric.js";

const bandLabel = (bandId) => {
  const band = BANDS.find((b) => b.id === bandId);
  return band ? band.label : "Pending";
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 16).replace("T", " ");
};

function renderEvaluation(doc, heading, evaluation) {
  doc.moveDown(0.75);
  doc.fontSize(13).text(heading, { underline: true });
  doc.moveDown(0.25);

  if (!evaluation) {
    doc.fontSize(10).fillColor("#666666").text("Not yet submitted.");
    doc.fillColor("#000000");
    return;
  }

  doc.fontSize(10).text(`Examiner: ${evaluation.examiner?.name ?? "—"}`);
  doc.text(`Submitted: ${formatDate(evaluation.submittedAt)}`);
  doc.moveDown(0.25);

  const scores = Array.isArray(evaluation.scores) ? evaluation.scores : [];
  for (const criterion of CRITERIA) {
    const entry = scores.find((s) => s.criterionId === criterion.id);
    const score = entry && entry.score !== null && entry.score !== undefined ? entry.score : "—";
    doc.text(`${criterion.title}: ${score}`);
  }

  doc.moveDown(0.25);
  doc.fontSize(11).text(`Total: ${evaluation.total ?? "—"}`);

  if (evaluation.generalComment) {
    doc.moveDown(0.25);
    doc.fontSize(10).text(`Comment: ${evaluation.generalComment}`);
  }
}

export function buildResultSheet({ session, chief, support }) {
  const doc = new PDFDocument({ margin: 40 });

  const apprentice = session.apprentice ?? {};

  doc.fontSize(16).text("NAITA Project Evaluation — Result Sheet", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text("Apprentice Details", { underline: true });
  doc.fontSize(10);
  doc.text(`Name: ${apprentice.name ?? "—"}`);
  doc.text(`Registration No: ${apprentice.registrationNumber ?? "—"}`);
  doc.text(`Course: ${apprentice.course ?? "—"}`);
  doc.text(`Training Centre: ${apprentice.trainingCentre ?? "—"}`);
  doc.text(`Project Title: ${apprentice.projectTitle ?? "—"}`);

  doc.moveDown(0.75);
  doc.fontSize(12).text("Session Details", { underline: true });
  doc.fontSize(10);
  doc.text(`Venue: ${session.venue ?? "—"}`);
  doc.text(`Scheduled: ${formatDate(session.scheduledAt)}`);
  doc.text(`Completed: ${formatDate(session.completedAt)}`);
  doc.text(`Duration (minutes): ${session.durationMinutes ?? "—"}`);

  renderEvaluation(doc, "Chief Examiner", chief);
  renderEvaluation(doc, "Support Examiner", support);

  doc.moveDown(0.75);
  doc.fontSize(12).text("Final Result", { underline: true });
  doc.fontSize(11);
  doc.text(`Final Mark: ${session.finalMark ?? "Pending"}`);
  doc.text(`Final Band: ${session.finalBand ? bandLabel(session.finalBand) : "Pending"}`);

  doc.end();
  return doc;
}
