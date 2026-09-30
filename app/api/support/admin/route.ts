import { NextResponse, after } from "next/server";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { supportDb, sameOrigin, notifySupport } from "../../../../lib/support";
export async function GET() {
  const user = await requireCreator();
  if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const db = await supportDb();
    const [messages, settings] = await Promise.all([
      db`SELECT id,email,category,subject,message,page,status,email_status,created_at FROM support_messages ORDER BY created_at DESC LIMIT 200`,
      db`SELECT email FROM support_settings WHERE id=1`
    ]);
    return NextResponse.json({
      messages, accountEmail: user!.email, recipient: process.env.SUPPORT_ADMIN_EMAIL || settings[0]?.email || "",
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.SUPPORT_FROM_EMAIL && (process.env.SUPPORT_ADMIN_EMAIL || settings[0]?.email))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load the admin inbox." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const user = await requireCreator();
  if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const body = await request.json();
    const db = await supportDb();
    if (body.action === "configure") {
      await db`INSERT INTO support_settings(id,email) VALUES(1,${user!.email}) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email`;
      return NextResponse.json({ saved: true });
    }
    if (!/^[a-f0-9-]{36}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
    if (body.action === "retry") {
      after(async () => { await notifySupport(body.id).catch(() => {}); });
      return NextResponse.json({ saved: true });
    }
    if (!["new","reviewed","resolved"].includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    await db`UPDATE support_messages SET status=${body.status} WHERE id=${body.id}::uuid`;
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: "Could not update the inbox." }, { status: 503 }); }
}
