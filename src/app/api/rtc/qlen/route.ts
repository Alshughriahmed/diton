import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { R } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

function noStore(req: Request, res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  const rid = req.headers.get("x-req-id") || "";
  if (rid) res.headers.set("x-req-id", rid);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return noStore(req, new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  await cookies();
  try {
    const total = await R.zcard("rtc:q");
    return noStore(req, NextResponse.json({ ok: true, qlen: { total } }, { status: 200 }));
  } catch (e: any) {
    return noStore(req, NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 }));
  }
}
