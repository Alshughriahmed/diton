import { allow, ipFrom } from "../../../../lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireVip } from "../../../../utils/vip";

export const runtime = "nodejs"; // نحتاج الوصول للكوكيز بثبات
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
  let genders: string[] = [];
  if (Array.isArray(genderRaw)) {
    genders = genderRaw.map(String).filter(Boolean);
  } else if (typeof genderRaw === "string" && genderRaw) {
    genders = [genderRaw.toLowerCase()];
  }
  
  const countriesRaw = input?.countries;
  let countries: string[] = [];
  if (Array.isArray(countriesRaw)) countries = countriesRaw.map(String).filter(Boolean);
  else if (typeof countriesRaw === "string") countries = countriesRaw.split(",").map(s => s.trim()).filter(Boolean);
  
  return { gender: genders, countries };
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
  
  // VIP filters check with enhanced country restrictions
  const genders = p.gender || [];
  const countriesArray = p.countries || [];
  
  const isVip = await requireVip();
  const c = await cookies();
  const myCountry = c.get("geo")?.value || req.headers.get("x-geo-country") || "";

  // غير-VIP: gender ≤ 1، countries ≤ 1، والدولة = ALL أو بلدي فقط
  if (!isVip && process.env.FREE_FOR_ALL !== "1") {
    if (genders.length > 1) {
      return NextResponse.json({ error: "VIP gender filter" }, { status: 403 });
    }
    if (countriesArray.length > 1) {
      return NextResponse.json({ error: "VIP country filter" }, { status: 403 });
    }
    if (countriesArray.length === 1 && countriesArray[0] !== "ALL" && myCountry && countriesArray[0] !== myCountry) {
      return NextResponse.json({ error: "VIP country filter" }, { status: 403 });
    }
  }

  // VIP: حدود أمان فقط
  if (isVip) {
    if (genders.length > 2) {
      return NextResponse.json({ error: "gender too many" }, { status: 400 });
    }
    if (countriesArray.length > 15) {
      return NextResponse.json({ error: "countries too many" }, { status: 400 });
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
  
  // VIP filters check with enhanced country restrictions
  const genders = p.gender || [];
  const countriesArray = p.countries || [];
  
  const isVip = await requireVip();
  const c = await cookies();
  const myCountry = c.get("geo")?.value || req.headers.get("x-geo-country") || "";

  // غير-VIP: gender ≤ 1، countries ≤ 1، والدولة = ALL أو بلدي فقط
  if (!isVip && process.env.FREE_FOR_ALL !== "1") {
    if (genders.length > 1) {
      return NextResponse.json({ error: "VIP gender filter" }, { status: 403 });
    }
    if (countriesArray.length > 1) {
      return NextResponse.json({ error: "VIP country filter" }, { status: 403 });
    }
    if (countriesArray.length === 1 && countriesArray[0] !== "ALL" && myCountry && countriesArray[0] !== myCountry) {
      return NextResponse.json({ error: "VIP country filter" }, { status: 403 });
    }
  }

  // VIP: حدود أمان فقط
  if (isVip) {
    if (genders.length > 2) {
      return NextResponse.json({ error: "gender too many" }, { status: 400 });
    }
    if (countriesArray.length > 15) {
      return NextResponse.json({ error: "countries too many" }, { status: 400 });
    }
  }
  
  return NextResponse.json({ ts: Date.now(), ...p });
}
