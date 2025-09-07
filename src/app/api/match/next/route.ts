import { allow, ipFrom } from "../../../../lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// hCaptcha verification function
async function verifyHCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) {
    // No hCaptcha configured, skip verification in stub mode
    return true;
  }
  
  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token
      })
    });
    
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

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
  const rl = allow(`${ip}:match-next`, 3, 2000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ 
      ok: false, 
      rate_limited: true, 
      needCaptcha: true,
      reset: rl.reset 
    }), { 
      status: 429, 
      headers: { "content-type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const gender = url.searchParams.get("gender");
  const countries = url.searchParams.get("countries");
  const hcaptchaToken = url.searchParams.get("hcaptcha_token");
  
  // Verify hCaptcha if token provided
  if (hcaptchaToken) {
    const isValidCaptcha = await verifyHCaptcha(hcaptchaToken);
    if (!isValidCaptcha) {
      return NextResponse.json({ error: "Invalid captcha" }, { status: 400 });
    }
  }
  
  const p = parse({ gender, countries });
  return NextResponse.json({ ts: Date.now(), ...p });
}

export async function POST(req: Request) {
  const ip = ipFrom(req);
  const rl = allow(`${ip}:match-next`, 3, 2000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ 
      ok: false, 
      rate_limited: true, 
      needCaptcha: true,
      reset: rl.reset 
    }), { 
      status: 429, 
      headers: { "content-type": "application/json" }
    });
  }

  const body = await req.json().catch(() => ({}));
  const { hcaptcha_token, ...params } = body;
  
  // Verify hCaptcha if token provided
  if (hcaptcha_token) {
    const isValidCaptcha = await verifyHCaptcha(hcaptcha_token);
    if (!isValidCaptcha) {
      return NextResponse.json({ error: "Invalid captcha" }, { status: 400 });
    }
  }
  
  const p = parse(params);
  return NextResponse.json({ ts: Date.now(), ...p });
}
