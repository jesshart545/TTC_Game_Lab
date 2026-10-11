/**
 * Credit and quota failures are an admin concern. End users must never see
 * balances, pricing, top-up paths, or "add credits" instructions: they get a
 * generic "temporarily unavailable" message while the admin is notified.
 */

const CREDIT_PATTERNS = /insufficient credit|not enough credit|credit balance|out of credit|exceeded.*quota|quota.*exceeded|billing|payment required/i;

export function isCreditError(status: number | undefined, message: string): boolean {
  if (status === 402) return true;
  return CREDIT_PATTERNS.test(String(message || ""));
}

// Loaded lazily so this module stays importable in environments without the
// database driver (tests, edge fallbacks); failures fall back to the log.
async function loadDb(): Promise<any | null> {
  try {
    const mod = await import("./db");
    return typeof mod?.getDb === "function" ? mod.getDb() : null;
  } catch {
    return null;
  }
}

/**
 * File a credit/quota failure for the admin. Uses the existing support-message
 * inbox the admin already reviews, falling back to the server log when the
 * database is unavailable.
 */
export async function notifyAdminOfCreditIssue(source: string, detail: string): Promise<void> {
  const message = `[Automated alert] ${source}: ${detail}`.slice(0, 2000);
  try {
    const db = await loadDb();
    if (db) {
      await db`CREATE TABLE IF NOT EXISTS support_messages(id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL,email TEXT NOT NULL,topic TEXT NOT NULL,message TEXT NOT NULL,page TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'New',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await db`INSERT INTO support_messages(user_id,email,topic,message,page) VALUES('system','system','Site issue',${message},${String(source).slice(0, 300)})`;
      return;
    }
  } catch (error) {
    console.error("Admin credit alert could not be saved:", error instanceof Error ? error.message : error);
  }
  console.error(`[ADMIN ALERT] credit issue (${source}): ${detail}`);
}
