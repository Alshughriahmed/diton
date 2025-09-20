import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signAnon(raw: string, secret?: string): string {
  if (!secret) return raw;
  const b64 = Buffer.from(raw, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

// توليد anon وإرساله ككوكي (GET و POST)
async function handle() {
  const raw =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    Math.random().toString(36).slice(2);

  const secret =
    process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET || "";

  const value = signAnon(raw, secret || undefined);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set(
    "Set-Cookie",
    `anon=${value}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`
  );
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET()  { return handle(); }
export async function POST() { return handle(); }
