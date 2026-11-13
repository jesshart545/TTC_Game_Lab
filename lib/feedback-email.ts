import nodemailer from "nodemailer";

/**
 * Feedback email: every "Submit feedback" submission is saved to the
 * support-message inbox first (that save is the guarantee), and this module
 * then tries to email a copy to the site admin at the fixed address below.
 *
 * The destination is a server-side constant — it is never taken from the
 * request — and sending is configured ONLY through environment variables:
 *
 *   FEEDBACK_SMTP_HOST   SMTP server host (required)
 *   FEEDBACK_SMTP_PORT   SMTP server port (required; 587 = STARTTLS, 465 = TLS)
 *   FEEDBACK_SMTP_USER   SMTP account user (required)
 *   FEEDBACK_SMTP_PASS   SMTP account password (required)
 *   FEEDBACK_EMAIL_FROM  From address (optional; defaults to FEEDBACK_SMTP_USER)
 *
 * When any required variable is missing the module quietly reports
 * "not-configured" and the caller skips sending; the saved submission is
 * unaffected. sendFeedbackEmail never throws: an email failure is logged
 * server-side and reported in the result, never surfaced to the user.
 */
export const FEEDBACK_RECIPIENT = "jessica@ttcgamelab.com";

export type FeedbackEmailResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "send-failed" };

type FeedbackSmtpSettings = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/** Read the SMTP settings from the environment; null when not configured. */
export function feedbackEmailSettings(env: NodeJS.ProcessEnv = process.env): FeedbackSmtpSettings | null {
  const host = String(env.FEEDBACK_SMTP_HOST || "").trim();
  const port = Number(env.FEEDBACK_SMTP_PORT || "");
  const user = String(env.FEEDBACK_SMTP_USER || "").trim();
  const pass = String(env.FEEDBACK_SMTP_PASS || "");
  if (!host || !user || !pass || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const from = String(env.FEEDBACK_EMAIL_FROM || "").trim() || user;
  return { host, port, user, pass, from };
}

export function feedbackEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return feedbackEmailSettings(env) !== null;
}

export async function sendFeedbackEmail(
  input: { fromEmail: string; topic: string; page: string; message: string },
  env: NodeJS.ProcessEnv = process.env,
): Promise<FeedbackEmailResult> {
  const settings = feedbackEmailSettings(env);
  if (!settings) return { sent: false, reason: "not-configured" };
  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      // Port 465 is implicit TLS; port 587 upgrades with STARTTLS.
      secure: settings.port === 465,
      requireTLS: settings.port === 587,
      auth: { user: settings.user, pass: settings.pass },
    });
    const lines = [
      `From: ${input.fromEmail || "(unknown account email)"}`,
      `Topic: ${input.topic}`,
      `Page: ${input.page || "(not provided)"}`,
      "",
      input.message,
    ];
    await transporter.sendMail({
      from: settings.from,
      to: FEEDBACK_RECIPIENT,
      ...(input.fromEmail ? { replyTo: input.fromEmail } : {}),
      subject: `[TTC Game Lab feedback] ${input.topic}`,
      text: lines.join("\n"),
    });
    return { sent: true };
  } catch (error) {
    console.error("Feedback email could not be sent:", error instanceof Error ? error.message : error);
    return { sent: false, reason: "send-failed" };
  }
}
