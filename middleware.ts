import { NextResponse, type NextRequest } from "next/server";

export const config = { matcher: ["/chat"] };

export function middleware(req: NextRequest) {
  // Check age verification cookie
  const ageok = req.cookies.get("ageok")?.value === "1";
  
  if (!ageok) {
    // Redirect to home with age required parameter - 307 status
    const url = new URL("/", req.url);
    url.searchParams.set("age", "required");
    return NextResponse.redirect(url, 307);
  }
  
  // Age verified, allow access to chat
  return NextResponse.next();
}