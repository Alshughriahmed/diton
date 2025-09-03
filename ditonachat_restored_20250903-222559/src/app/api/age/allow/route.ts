import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  
  // Set age verification cookie
  response.cookies.set('ageok', 'true', {
    maxAge: 31536000, // ~1 year
    sameSite: 'lax',
    httpOnly: false,
    secure: false
  });
  
  return response;
}