import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, echo: body, ts: Date.now() });
}
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST JSON to echo-message' });
}
