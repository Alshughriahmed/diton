import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  // dev cookie fallback (still supported)
  const c = (await cookies()).get("vip");
  if (c?.value === "1") return NextResponse.json({ isVip: true, via: "cookie" }, { status: 200 });
  
  // For now, return anon until Prisma client is properly configured
  return NextResponse.json({ isVip: false, via: "anon" }, { status: 200 });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";