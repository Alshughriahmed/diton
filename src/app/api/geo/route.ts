export const revalidate = 0;
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
export async function GET(req: Request) {
  const h = new Headers((req as any).headers);
  const data = {
    country: h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || null,
    city:    h.get("x-vercel-ip-city")    || null,
    region:  h.get("x-vercel-ip-region")  || null,
    lat:     h.get("x-vercel-ip-latitude")|| null,
    lon:     h.get("x-vercel-ip-longitude")|| null,
    ip:      h.get("x-forwarded-for")     || h.get("x-real-ip") || null,
    src: "headers"
  };
  return withReqId(NextResponse.json(data, { status: 200 }));
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
