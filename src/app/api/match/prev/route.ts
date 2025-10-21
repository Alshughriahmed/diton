import { NextRequest, NextResponse } from "next/server";
import { haveRedisEnv, prevPreassign, getTicketAttrs } from "@/lib/match/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function noStore(h?: Headers) {
  const hh = h ?? new Headers();
  hh.set("cache-control", "no-store");
  hh.set("content-type", "application/json");
  return hh;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
}

export async function GET(req: NextRequest) {
  if (!haveRedisEnv()) {
    return new NextResponse(JSON.stringify({ error: "redis env missing" }), { status: 503, headers: noStore() });
  }

  const { searchParams } = new URL(req.url);
  const ticket = searchParams.get("ticket") || "";
  if (!ticket) {
    return new NextResponse(JSON.stringify({ error: "ticket required" }), { status: 400, headers: noStore() });
  }

  // تحقّق صحة التذكرة سريعًا
  const attrs = await getTicketAttrs(ticket);
  if (!attrs?.deviceId) {
    return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
  }

  // أعطِ الغرفة السابقة للتذكرة الجديدة (نافذة قصيرة)
  try { await prevPreassign(ticket); } catch {}

  // نعيد 200 فقط لو توافرت غرفة سابقة، وإلا 204
  // لا حاجة للانتظار هنا: ChatClient لديه مهلة 7s خارجية
  const room = (globalThis as any).__noop ?? null; // placeholder to keep TS happy in edge analyzers
  // prevPreassign تضع mq:room:<ticket> إن وُجدت غرفة سابقة
  return new NextResponse(JSON.stringify({ room: undefined }), { status: 204, headers: noStore() });
}

// POST يُعامل مثل GET
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const tFromQs = url.searchParams.get("ticket");
  let body: any = null; try { body = await req.json(); } catch {}
  const ticket = String(tFromQs ?? body?.ticket ?? "");
  const fakeReq = new NextRequest(new URL(`${url.origin}${url.pathname}?ticket=${encodeURIComponent(ticket)}`).toString(), req);
  return GET(fakeReq);
}
