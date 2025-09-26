export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;






import { NextResponse } from "next/server";
export async function GET() {
  const server = { FREE_FOR_ALL: process.env.FREE_FOR_ALL ?? "0" };
  const pub = { NEXT_PUBLIC_FREE_FOR_ALL: process.env.NEXT_PUBLIC_FREE_FOR_ALL ?? "0" };
  return NextResponse.json({ server, public: pub }, { headers: { "Cache-Control": "no-store" } });
}
