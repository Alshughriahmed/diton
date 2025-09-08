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
    
    // Set VIP cookie as well for immediate frontend access
    res.cookies.set("vip", "1", { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
    
    return res;
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";