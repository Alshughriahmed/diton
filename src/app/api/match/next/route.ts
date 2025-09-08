import { allow, ipFrom } from "../../../../lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { requireVip } from "../../../../utils/vip";
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
  const prev = (req.headers.get("x-ditona-prev") === "1");
  if (prev) {
    try {
      const { getServerSession } = await import("next-auth");
      const session = await getServerSession();
      if (!session) { return new Response("prev requires auth", { status: 403 }); }
    } catch { return new Response("prev requires auth", { status: 403 }); }
  }
  
  try { const h = new Headers(req.headers); const _g = h.get("x-ditona-my-gender"); const _geo = h.get("x-ditona-geo"); void(_g); void(_geo); } catch {}
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
  
  // VIP filters check
  const genders = Array.isArray(p.gender) ? p.gender : (p.gender ? [p.gender] : []);
  const countriesArray = p.countries || [];
  
  const isVip = await requireVip();
  if (!isVip && process.env.FREE_FOR_ALL !== "1") {
    if (genders.length > 1) {
      return NextResponse.json({ error: "VIP gender filter" }, { status: 403 });
    }
    if (countriesArray.length > 1) {
      return NextResponse.json({ error: "VIP country filter" }, { status: 403 });
    }
  }
  if (isVip) {
    if (genders.length > 2) {
      return NextResponse.json({ error: "max 2 genders" }, { status: 400 });
    }
    if (countriesArray.length > 15) {
      return NextResponse.json({ error: "max 15 countries" }, { status: 400 });
    }
  }
  
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
  
  // VIP filters check  
  const genders = Array.isArray(p.gender) ? p.gender : (p.gender ? [p.gender] : []);
  const countriesArray = p.countries || [];
  
  const isVip = await requireVip();
  if (!isVip && process.env.FREE_FOR_ALL !== "1") {
    if (genders.length > 1) {
      return NextResponse.json({ error: "VIP gender filter" }, { status: 403 });
    }
    if (countriesArray.length > 1) {
      return NextResponse.json({ error: "VIP country filter" }, { status: 403 });
    }
  }
  if (isVip) {
    if (genders.length > 2) {
      return NextResponse.json({ error: "max 2 genders" }, { status: 400 });
    }
    if (countriesArray.length > 15) {
      return NextResponse.json({ error: "max 15 countries" }, { status: 400 });
    }
  }
  
  return NextResponse.json({ ts: Date.now(), ...p });
}
