import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl) throw new Error("NEON_AUTH_BASE_URL is required.");
if (!cookieSecret || cookieSecret.length < 32) throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters.");

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sessionDataTtl: 300,
    domain: process.env.NODE_ENV === "production" ? ".ttcgamelab.com" : undefined,
  },
});

export async function requireCreator() {
  const result: any = await auth.getSession();
  const session = result?.data ?? result;
  const user = session?.user;
  if (!user?.id) return null;
  return { id: String(user.id), email: String(user.email || ""), role: String(user.role || "user") };
}

export function isAdmin(user: { role?: string; email?: string } | null) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const admins = (process.env.TTC_ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return !!user.email && admins.includes(user.email.toLowerCase());
}
