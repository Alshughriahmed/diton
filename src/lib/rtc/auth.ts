// Authentication helpers for RTC
import { verifyAnonId } from "./ids";

export function extractAnonId(req: Request): string | null {
  // Try header first
  const headerAnon = req.headers.get("x-anon-id");
  if (headerAnon) return headerAnon;
  
  // Try cookie
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  const anonCookie = cookies.anon;
  if (!anonCookie) return null;
  
  const secret = process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET || "fallback-dev-secret-not-for-production";
  if (!secret) return null;
  
  return verifyAnonId(anonCookie, secret);
}