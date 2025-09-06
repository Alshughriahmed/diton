import { allow, ipFrom } from "../../../lib/ratelimit";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

function parse(input: any) {
  const genderRaw = input?.gender ?? null;
  const g = (typeof genderRaw === "string" && genderRaw.toLowerCase()) || null;
  const countriesRaw = input?.countries;
  let countries: string[] = [];
  if (Array.isArray(countriesRaw)) countries = countriesRaw.map(String);
  else if (typeof countriesRaw === "string") countries = countriesRaw.split(",").map(s => s.trim()).filter(Boolean);
  return { gender: g, countries };
}

export async function GET(req: Request) {
  const ip = ipFrom(req);
  const rl = allow(`${ip}:match-next`, 60, 60_000);
  if (!rl.ok) return new Response(JSON.stringify({ ok:false, rate_limited:true, reset: rl.reset }), { status: 429, headers: { "content-type": "application/json" }});

  const url = new URL(req.url);
  const gender = url.searchParams.get("gender");
  const countries = url.searchParams.get("countries");
  const p = parse({ gender, countries });
  return NextResponse.json({ ts: Date.now(), ...p });
}

export async function POST(req: Request) {
  const ip = ipFrom(req);
  const rl = allow(`${ip}:match-next`, 60, 60_000);
  if (!rl.ok) return new Response(JSON.stringify({ ok:false, rate_limited:true, reset: rl.reset }), { status: 429, headers: { "content-type": "application/json" }});

  const body = await req.json().catch(() => ({}));
  const p = parse(body);
  return NextResponse.json({ ts: Date.now(), ...p });
}
