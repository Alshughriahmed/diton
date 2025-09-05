import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "_ops", "runtime", "stripe_events.json");

async function loadSet(): Promise<Set<string>> {
  try {
    const buf = await fs.readFile(FILE, "utf8");
    const arr = JSON.parse(buf) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function saveSet(set: Set<string>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const arr = Array.from(set);
  await fs.writeFile(FILE, JSON.stringify(arr, null, 2));
}

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(req, 'stripe-webhook');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  
  let body: any;
  try { 
    body = await req.json(); 
  } catch { 
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); 
  }
  
  const id = body?.id;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }
  
  const set = await loadSet();
  const duplicate = set.has(id);
  if (!duplicate) { 
    set.add(id); 
    await saveSet(set); 
  }
  
  return NextResponse.json({ ok: true, duplicate }, { status: 200 });
}