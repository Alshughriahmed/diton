import { NextResponse, type NextRequest } from "next/server";
import { verifyAgeJWT } from "@/lib/age-jwt";

export const config = { matcher: ["/chat"] };

export async function middleware(req: NextRequest) {
  // Check for age_jwt cookie
  const ageJWT = req.cookies.get("age_jwt")?.value;
  
  if (!ageJWT) {
    // No age verification token, redirect to age verification
    return NextResponse.redirect(new URL("/api/age/start", req.url), 307);
  }
  
  // Verify JWT token
  const isValidAge = await verifyAgeJWT(ageJWT);
  
  if (!isValidAge) {
    // Invalid/expired token, redirect to age verification
    return NextResponse.redirect(new URL("/api/age/start", req.url), 307);
  }
  
  // Age verified, allow access to chat
  return NextResponse.next();
}