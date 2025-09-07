import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/chat')) {
    res.headers.set('Permissions-Policy', 'camera=(self), microphone=(self)');
  }
  return res;
}
export const config = { matcher: ['/chat/:path*'] };
