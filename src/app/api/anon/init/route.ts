import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// توليد anon وإرساله ككوكي (GET و POST)
async function handle() {
  const anon = randomUUID();
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `anon=${anon}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`
  );
  return res;
}

export async function GET()  { return handle(); }
export async function POST() { return handle(); }
