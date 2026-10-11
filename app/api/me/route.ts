import { NextResponse } from "next/server";
import { requireCreator } from "../../../lib/auth/server";

export async function GET() {
  const user = await requireCreator();
  return NextResponse.json({ email: user?.email || null });
}
