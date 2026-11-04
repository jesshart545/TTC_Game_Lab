import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireCreator, isAdmin } from "../../../lib/auth/server";
import { ensureProtectionSchema } from "../../../lib/project-protection";
import { createHash, randomBytes } from "node:crypto";
import { readCityCrimeSceneConfig, sanitizeCityCrimeSceneForOverlay, canUseCityCrimeScene, stripCityCrimeSceneTools } from "../../../lib/city-crime-scene";
import { scrubQuizQuestionsForPublish } from "../../../lib/quiz";
import { creatorEmailForViewer } from "../../../lib/creator-identity";

export async function GET() {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, projects: [] });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await db`CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects(owner_id)`;
  await ensureProtectionSchema(db);
  // Trashed (soft-deleted) projects never appear in the library.
  const admin = isAdmin(user);
  const rows = admin
    ? await db`SELECT id, slug, name, description, status, theme, updated_at, prompt, data, owner_id FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC`
    : await db`SELECT id, slug, name, description, status, theme, updated_at, prompt, data, owner_id FROM projects WHERE owner_id = ${user.id} AND deleted_at IS NULL ORDER BY updated_at DESC`;
  // Creator identification is admin-only: for an admin requester, resolve
  // every project's owner_id to the creating account's email in ONE batched
  // lookup. For everyone else the emails are never even queried — the
  // response carries creatorEmail: null — and owner_id itself is stripped
  // from the payload rather than sent to the client.
  let emailByOwnerId = new Map<string, string>();
  if (admin) {
    const ownerIds = [...new Set(rows.map(row => (row as { owner_id?: unknown }).owner_id).filter((id): id is string => typeof id === "string" && !!id))];
    if (ownerIds.length) {
      try {
        const ownerUsers = await db`SELECT id, email FROM neon_auth.user WHERE id = ANY(${ownerIds})`;
        emailByOwnerId = new Map(ownerUsers.map(owner => [String(owner.id), owner.email ? String(owner.email) : ""]));
      } catch { emailByOwnerId = new Map(); }
    }
  }
  const projects = rows.map(row => {
    const { owner_id, ...rest } = row as { owner_id?: string | null } & Record<string, unknown>;
    return { ...rest, creatorEmail: creatorEmailForViewer(admin, owner_id ? emailByOwnerId.get(String(owner_id)) : null) };
  });
  return NextResponse.json({ configured: true, projects, viewerIsAdmin: admin });
}

export async function POST(request: Request) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const incoming = await request.json();
  const body = incoming.project ?? incoming;
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await ensureProtectionSchema(db);
  const id = String(body.id);
  const slug = String(body.slug);
  const name = String(body.name);
  const description = String(body.description ?? "");
  const status = String(body.status ?? "Draft");
  const theme = String(body.theme ?? "cyan");
  const prompt = String(body.prompt ?? "");
  // City Crime Scene follows the PROJECT OWNER, not whoever happens to save.
  // The saver's own entitlement is the starting verdict (it is exactly right
  // for a first insert, where the saver becomes the owner, for legacy rows
  // with no recorded owner, and whenever the saver IS the owner). Only a
  // cross-account save re-decides by the stored owner's entitlement — so an
  // entitled admin saving someone else's project cannot leave CCS in it, and
  // a non-entitled admin saving an entitled owner's project cannot strip it.
  // If the owner lookup itself fails, the saver's verdict stands.
  const existingRows = await db`SELECT id, name, owner_id FROM projects WHERE id = ${id} LIMIT 1`;
  const storedOwnerId = existingRows[0]?.owner_id ? String(existingRows[0].owner_id) : null;
  let keepCcss = canUseCityCrimeScene(user?.email);
  if (storedOwnerId && storedOwnerId !== user.id) {
    try {
      const ownerUsers = await db`SELECT email FROM neon_auth.user WHERE id = ${storedOwnerId} LIMIT 1`;
      keepCcss = canUseCityCrimeScene(ownerUsers[0]?.email ? String(ownerUsers[0].email) : null);
    } catch { /* owner lookup unavailable: keep the saver's own verdict */ }
  }
  const data = (() => {
    // City Crime Scene is restricted to projects owned by select accounts: strip it on save otherwise.
    const payload = keepCcss ? (body.data ?? body) : stripCityCrimeSceneTools(body.data ?? body);
    // Strip host-only City Crime Scene fields (guilt, case truth, twists, detective intel)
    // from the published snapshot BEFORE persisting: the overlay endpoint serves it without auth.
    // The host dashboard fetches the full case file via the host-key-gated live casefile endpoint.
    const snapshot = (payload as { publishedSnapshot?: { gameTools?: Array<{ type?: string; config?: Record<string, unknown> }> } }).publishedSnapshot;
    if (snapshot && Array.isArray(snapshot.gameTools)) {
      for (const t of snapshot.gameTools) {
        if (t?.type === "city-crime-scene" && t.config) {
          t.config = { ...t.config, mystery: sanitizeCityCrimeSceneForOverlay(readCityCrimeSceneConfig(t.config)) };
        }
        // Quiz correctness is host-only too: the snapshot keeps each quiz
        // question and its choices, never which choice is right — the
        // reveal travels through the host-gated live card states.
        if (t?.type === "trivia-list" && t.config && Array.isArray(t.config.questions)) {
          t.config = { ...t.config, questions: scrubQuizQuestionsForPublish(t.config.questions) };
        }
      }
    }
    return JSON.stringify(payload);
  })();
  const saved = await db`INSERT INTO projects (id, slug, name, description, status, theme, prompt, data, owner_id, updated_at) VALUES (${id}, ${slug}, ${name}, ${description}, ${status}, ${theme}, ${prompt}, ${data}::jsonb, ${user.id}, NOW()) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status, theme=EXCLUDED.theme, prompt=EXCLUDED.prompt, data=EXCLUDED.data, updated_at=NOW() WHERE (projects.owner_id = ${user.id} OR ${isAdmin(user)}) AND projects.deleted_at IS NULL RETURNING id`;
  if (!saved.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (incoming.publish === true && body.publishedSnapshot) {
    await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
    const existing = await db`SELECT token_hash FROM live_hosts WHERE project_id = ${id}`;
    const suppliedKey = typeof incoming.hostKey === "string" && /^[a-f0-9]{64}$/.test(incoming.hostKey) ? incoming.hostKey : "";
    const hostKey = suppliedKey && existing[0]?.token_hash === createHash("sha256").update(suppliedKey).digest("hex") ? suppliedKey : randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(hostKey).digest("hex");
    await db`INSERT INTO live_hosts (project_id, token_hash) VALUES (${id}, ${hash}) ON CONFLICT (project_id) DO UPDATE SET token_hash = EXCLUDED.token_hash`;
    return NextResponse.json({ ok: true, id, hostKey });
  }
  return NextResponse.json({ ok: true, id });
}

