import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gender = searchParams.get('gender') ?? 'all';
  const countries = (searchParams.get('countries') ?? 'ALL').split(',').filter(Boolean);
  console.log('[MATCH_NEXT]', { gender, countries, ts: Date.now() });
  return NextResponse.json({ ok: true, gender, countries, ts: Date.now() }, { status: 200 });
}

export const dynamic = 'force-dynamic';