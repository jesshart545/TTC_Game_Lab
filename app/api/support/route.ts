import { NextResponse } from "next/server";
import { after } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { requireCreator, isAdmin } from "../../../lib/auth/server";
import { sameOrigin, supportDb, notifySupport } from "../../../lib/support";

export async function GET() {
  const user = await requireCreator().catch(() => null);
  return NextResponse.json({ email: user?.email || "", admin: isAdmin(user) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 14000) return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid message." }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const category = body.category;
  const page = typeof body.page === "string" ? body.page.split(/[?#]/)[0].slice(0,500) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !["concern","site issue","recommendation"].includes(category) || subject.length < 3 || subject.length > 120 || message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: "Enter a valid email, subject, and message (10–5,000 characters)." }, { status: 400 });
  }
  if (body.website) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const user = await requireCreator().catch(() => null);
    const db = await supportDb();
    const ip = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown";
    const bucket = Math.floor(Date.now()/3600000);
    const key = createHash("sha256").update((user?.id || ip) + ":" + bucket).digest("hex");
    const rate = await db`INSERT INTO support_rate_limits(key,count) VALUES(${key},1)
      ON CONFLICT(key) DO UPDATE SET count=support_rate_limits.count+1 WHERE support_rate_limits.count<5 RETURNING count`;
    if (!rate.length) return NextResponse.json({ error: "Please wait before sending more messages. Limit: five per hour." }, { status: 429 });
    const id = randomUUID();
    await db`INSERT INTO support_messages(id,user_id,email,category,subject,message,page)
      VALUES(${id}::uuid,${user?.id || null},${email},${category},${subject},${message},${page})`;
    after(async () => { await notifySupport(id).catch(() => {}); });
    return NextResponse.json({ id, saved: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "We could not save your message. Please try again." }, { status: 503 });
  }
}
