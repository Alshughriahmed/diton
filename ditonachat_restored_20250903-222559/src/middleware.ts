import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Permissions Policy - restrict sensitive features
  response.headers.set('Permissions-Policy', 
    'camera=self, microphone=self, geolocation=(), payment=self, usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Content Security Policy - compatible with NextAuth and Stripe
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.stripe.com *.google.com *.googleapis.com",
    "style-src 'self' 'unsafe-inline' *.googleapis.com",
    "img-src 'self' data: blob: *.google.com *.googleusercontent.com",
    "font-src 'self' *.googleapis.com *.gstatic.com",
    "connect-src 'self' *.stripe.com *.google.com *.googleapis.com wss: ws:",
    "frame-src 'self' *.stripe.com *.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' *.stripe.com *.google.com"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', cspDirectives);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};