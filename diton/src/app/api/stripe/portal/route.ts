import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'Portal endpoint' });
}export const runtime="nodejs";
export const dynamic="force-dynamic";
