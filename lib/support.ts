import { getDb } from "./db";
export async function supportDb() {
  const db = getDb();
  if (!db) throw new Error("Support is temporarily unavailable.");
  await db`CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY, user_id TEXT, email TEXT NOT NULL, category TEXT NOT NULL,
    subject TEXT NOT NULL, message TEXT NOT NULL, page TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new', email_status TEXT NOT NULL DEFAULT 'pending',
    email_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS support_settings (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL)`;
  await db`CREATE TABLE IF NOT EXISTS support_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL)`;
  return db;
}
export async function notifySupport(id: string) {
  const db = await supportDb();
  const rows = await db`SELECT * FROM support_messages WHERE id=${id}::uuid`;
  const report = rows[0];
  if (!report || report.email_status === "sent") return;
  const settings = await db`SELECT email FROM support_settings WHERE id=1`;
  const recipient = process.env.SUPPORT_ADMIN_EMAIL || settings[0]?.email;
  const key = process.env.RESEND_API_KEY;
  const sender = process.env.SUPPORT_FROM_EMAIL;
  if (!recipient || !key || !sender) {
    await db`UPDATE support_messages SET email_status='not configured' WHERE id=${id}::uuid`;
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Idempotency-Key": "support-" + id },
      body: JSON.stringify({
        from: sender, to: [recipient], reply_to: report.email,
        subject: "[TTCGameLab " + report.category + "] " + report.subject,
        text: "Report: " + id + "\nFrom: " + report.email + "\nPage: " + report.page + "\n\n" + report.message + "\n\nAdmin inbox: https://www.ttcgamelab.com/admin/support"
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok || !data.id) throw new Error("Email delivery rejected.");
    await db`UPDATE support_messages SET email_status='sent', email_id=${String(data.id)} WHERE id=${id}::uuid`;
  } catch {
    await db`UPDATE support_messages SET email_status='failed' WHERE id=${id}::uuid`;
  }
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
