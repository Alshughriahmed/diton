import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (host === "ditonachat.com") {
    const url = new URL(req.url);
    url.host = "www.ditonachat.com";
    return NextResponse.redirect(url.toString(), 308);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next|api/turn).*)"] };