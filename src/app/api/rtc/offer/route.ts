export const preferredRegion = ["fra1", "iad1"];
const __withNoStore = <T extends Response>(r: T): T => { try { (r as any).headers?.set?.("cache-control", "no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, setNxPx, expire } from "@/lib/rtc/upstash";
import { createHash } from "node:crypto";

function __noStore(res: any) { try { res.headers?.set?.("Cache-Control", "no-store"); } catch {} return res; }

async function auth(anon: string, pairId: string) {
  const map = await get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pid, role] = String(map).split("|");
  return pid === pairId ? role : null;
}

/**
 * Idempotent POST /offer
 * المفتاح: (pairId, role, sdpTag|fingerprint[, clientIdemKey]) مع TTL≈60s
 * - أوّل طلب يمرّ: يكتب offer بقفل NX (120s)
 * - التكرارات خلال نافذة الـTTL تعيد 204 بلا تعديل حالة
 * - أخطاء التحقق تبقى حقيقية
 */
export async function POST(req: NextRequest) {
  const anon = extractAnonId(req);
  if (!anon) return __noStore(NextResponse.json({ error: "anon-required" }, { status: 403 }));

  const { pairId, sdp } = await req.json().catch(() => ({} as any));
  if (!pairId || !sdp) return __noStore(NextResponse.json({ error: "bad-input" }, { status: 400 }));

  const role = await auth(anon, pairId);
  if (role !== "caller") return __noStore(NextResponse.json({ error: "only-caller" }, { status: 403 }));

  // مفاتيح ال idempotency
  const h = req.headers;
  const sdpTag = (h.get("x-sdp-tag") || "").trim() || null;
  const clientKey = (h.get("x-idempotency-key") || "").trim() || null;
  const fp = createHash("sha256").update(String(sdp)).digest("hex").slice(0, 16);

  const idemKey = `rtc:idem:offer:${pairId}:${role}:${sdpTag || fp}:${clientKey || ""}`;
  const isFirst = await setNxPx(idemKey, "1", 60_000); // TTL 60s

  if (!isFirst) {
    // تكرار ضمن نافذة التكرار → 204 بلا تغيير حالة
    return __noStore(new NextResponse(null, { status: 204 }));
  }

  // محاولة كتابة الـoffer بقفل NX
  const offerKey = `rtc:pair:${pairId}:offer`;
  const ok = await setNxPx(offerKey, String(sdp), 120_000);
  if (!ok) return __noStore(NextResponse.json({ error: "exists" }, { status: 409 }));

  await expire(`rtc:pair:${pairId}`, 150);
  return __noStore(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const anon = extractAnonId(req);
  if (!anon) return __noStore(NextResponse.json({ error: "anon-required" }, { status: 403 }));

  const pairId = String(new URL(req.url).searchParams.get("pairId") || "");
  if (!pairId) return __noStore(NextResponse.json({ error: "bad-input" }, { status: 400 }));

  const role = await auth(anon, pairId);
  if (role !== "callee") return __noStore(NextResponse.json({ error: "only-callee" }, { status: 403 }));

  const sdp = await get(`rtc:pair:${pairId}:offer`);
  if (!sdp) return __noStore(new NextResponse(null, { status: 204 }));

  await expire(`rtc:pair:${pairId}`, 150);
  return __noStore(NextResponse.json({ sdp: String(sdp) }, { status: 200 }));
}
