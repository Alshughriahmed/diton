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
  const url = new URL(req.url);
  const gender = url.searchParams.get("gender");
  const countries = url.searchParams.get("countries");
  const p = parse({ gender, countries });
  return NextResponse.json({ ts: Date.now(), ...p });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const p = parse(body);
  return NextResponse.json({ ts: Date.now(), ...p });
}
