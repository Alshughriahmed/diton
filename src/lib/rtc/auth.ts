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
    // Check for x-anon-id header ONLY in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      const anonHeader = req.headers.get("x-anon-id");
      if (anonHeader) return anonHeader;
    }
    
    // Check for anon cookie
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    
    const cookies = Object.fromEntries(
      cookieHeader.split(/;\s*/).map(c => {
        const eqIndex = c.indexOf('=');
        return eqIndex > 0 ? [c.slice(0, eqIndex), c.slice(eqIndex + 1)] : [c, ''];
      })
    );
    
    const raw = cookies.anon || cookies.ditona_anon;
    if (!raw) return null;
    
    const sec = process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET; 
    
    // In dev without secrets, accept raw cookie values
    if (process.env.NODE_ENV !== 'production' && !sec) {
      return decodeURIComponent(raw);
    }
    
    if (!sec) return null;
    
    // Try to verify as signed cookie first
    const verified = verifySigned(decodeURIComponent(raw), sec);
    if (verified) return verified;
    
    // In dev, also accept raw values even with secrets (for testing)
    if (process.env.NODE_ENV !== 'production') {
      return decodeURIComponent(raw);
    }
    
    return null;
  } catch {
    return null;
  }
}

// Legacy compatibility function
export function getAnonIdUnsafe(): string | null {
  // This would normally use cookies/headers but for API routes we'll use extractAnonId instead
  return null;
}
