import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth/server";

const protectCreator = auth.middleware({ loginUrl: "/auth/sign-in" });

export async function proxy(request: NextRequest) {
  const domain = process.env.PROJECT_BASE_DOMAIN?.toLowerCase().replace(/^\./, "");
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(":")[0].toLowerCase();

  if (domain && host !== `www.${domain}` && host.endsWith(`.${domain}`)) {
    const slug = host.slice(0, -domain.length - 1);
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      const path = request.nextUrl.pathname;
      if ((path.startsWith("/api/live/") || path.startsWith("/api/published/"))) return NextResponse.next();
      if (path.startsWith("/_next/") || path === "/favicon.ico") return NextResponse.next();
      if (path !== "/" && path !== "/overlay") return NextResponse.rewrite(new URL("/404", request.url));
      const destination = request.nextUrl.clone();
      destination.pathname = `/published/${slug}${path === "/overlay" ? "/overlay" : ""}`;
      return NextResponse.rewrite(destination);
    }
  }

  const path = request.nextUrl.pathname;
  if (path.startsWith("/published/") || (path.startsWith("/api/live/") || path.startsWith("/api/published/")) || path.startsWith("/api/auth/") || path.startsWith("/auth/")) return NextResponse.next();
  return protectCreator(request);
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
