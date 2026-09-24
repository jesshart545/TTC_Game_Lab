import { NextRequest, NextResponse } from "next/server";

// Point a wildcard project domain at this app and set PROJECT_BASE_DOMAIN.
// A project slug then gets its own host: slug.example.com/ and /overlay.
export function proxy(request: NextRequest) {
  const domain = process.env.PROJECT_BASE_DOMAIN?.toLowerCase().replace(/^\./, "");
  if (!domain) return NextResponse.next();
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host.endsWith(`.${domain}`)) return NextResponse.next();
  const slug = host.slice(0, -domain.length - 1);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") || path.startsWith("/_next/") || path === "/favicon.ico") return NextResponse.next();
  if (path !== "/" && path !== "/overlay") return NextResponse.rewrite(new URL("/404", request.url));
  const destination = request.nextUrl.clone();
  destination.pathname = `/published/${slug}${path === "/overlay" ? "/overlay" : ""}`;
  return NextResponse.rewrite(destination);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
