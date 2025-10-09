import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, hNoStore, anonFrom } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

export async function GET(req: NextRequest) {
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { ok: false, anon: null, note: "no-anon" }, 200);

  const k = `rtc:attrs:${anon}`;
  const v = await R.get(k);
  return new Response(
    JSON.stringify({ ok: true, anon, key: k, exists: !!v, sample: v ? String(v).slice(0,200) : null }),
    { status: 200, headers: hNoStore(req, { "content-type": "application/json" }) }
  );
}
