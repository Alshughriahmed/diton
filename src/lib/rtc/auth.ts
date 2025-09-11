import { createHmac } from "crypto";

function verifySigned(raw: string, secret: string) { 
  const [b64, sig] = raw.split("."); 
  if (!b64 || !sig) return null; 
  const calc = createHmac("sha256", secret).update(b64).digest("hex"); 
  if (calc !== sig) return null; 
  return Buffer.from(b64, "base64url").toString("utf8"); 
}

// Simplified version that works with API routes via request headers/cookies
export function extractAnonId(req: Request): string | null {
  try {
    // Check for x-anon-id header first (for testing)
    const anonHeader = req.headers.get("x-anon-id");
    if (anonHeader) return anonHeader;
    
    // Check for anon cookie
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map(c => c.split("="))
    );
    
    const raw = cookies.anon;
    if (!raw) return null;
    
    const sec = process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET || "fallback-dev-secret-not-for-production"; 
    if (!sec) return null;
    
    return verifySigned(decodeURIComponent(raw), sec);
  } catch {
    return null;
  }
}

// Legacy compatibility function
export function getAnonIdUnsafe(): string | null {
  // This would normally use cookies/headers but for API routes we'll use extractAnonId instead
  return null;
}
