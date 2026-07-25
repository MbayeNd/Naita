import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/**
 * Notifies an examiner they've been assigned to a session.
 * Never throws — a broken or unconfigured email provider must not
 * block scheduling. Failures are logged and swallowed.
 */
export async function sendExaminerAssignedEmail({ examiner, session, apprentice, role }) {
  if (!resend) {
    console.warn("Email not sent: RESEND_API_KEY is not configured.");
    return;
  }
  if (!examiner?.email) return;

  const when = new Date(session.scheduledAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  try {
    await resend.emails.send({
      from: env.emailFrom,
      to: examiner.email,
      subject: `You've been assigned as ${role} examiner — ${apprentice.name}`,
      text: [
        `Hi ${examiner.name},`,
        "",
        `You have been assigned as the ${role} examiner for an upcoming project evaluation.`,
        "",
        `Apprentice: ${apprentice.name} (${apprentice.registrationNumber})`,
        `Venue: ${session.venue}`,
        `Scheduled: ${when}`,
        `Duration: ${session.durationMinutes} minutes`,
        "",
        "Please sign in to the NAITA Project Evaluation Tool ahead of the session.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Failed to send examiner assignment email:", error.message);
  }
}