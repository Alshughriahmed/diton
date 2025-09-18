import { NextResponse } from "next/server";
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  try { const { pathname } = new URL(req.url); if (pathname.startsWith("/api/like")) { return NextResponse.next(); } } catch {}
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const host = req.headers.get('host') || '';
  if (
    host.endsWith('.replit.dev') ||
    host.endsWith('.vercel.app') ||
    host.startsWith('localhost')
  ) return NextResponse.next();

  if (host !== 'www.ditonachat.com') {
    const url = new URL(req.nextUrl);
    url.host = 'www.ditonachat.com';
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|fonts|assets).*)'],
};
