import { NextRequest, NextResponse } from "next/server";

// Mock VIP storage for development
const VIP_USERS = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    
    VIP_USERS.add(email.toLowerCase());
    console.log("[VIP_GRANTED]", email);
    
    const res = NextResponse.json({ 
      ok: true, 
      message: "VIP status granted",
      email: email.toLowerCase(),
      isVip: true
    });
    
    // Set VIP cookie with security attributes
    const prod = process.env.VERCEL_ENV === "production";
    res.cookies.set({
      name: "vip",
      value: "1",                 // للاختبار فقط. في الإنتاج استخدم claim الموقّع.
      httpOnly: true,
      secure: prod,               // true على الإنتاج
      sameSite: "lax",
      path: "/",
      ...(prod ? { domain: ".ditonachat.com" } : {}),
      maxAge: 60 * 60 * 24 * 30   // 30 يوم
    });
    
    return res;
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";