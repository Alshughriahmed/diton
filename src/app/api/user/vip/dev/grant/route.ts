export const revalidate = 0;
const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
import { NextRequest, NextResponse } from "next/server";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export const dynamic = 'force-dynamic';

// Mock VIP storage for development
const VIP_USERS = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== "string") {
      return __noStore(NextResponse.json({ error: "Invalid email" }, { status: 400 }));
    }
    
    VIP_USERS.add(email.toLowerCase());
    console.log("[VIP_GRANTED]", email);
    
    return __noStore(NextResponse.json({ 
      ok: true, 
      message: "VIP status granted",
      email: email.toLowerCase(),
      isVip: true
    }, { status: 200 }));
  } catch (error) {
    return __noStore(NextResponse.json({ error: "Invalid request" }, { status: 400 }));
  }
}

export const runtime = "nodejs";
