import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    prices: [
      { id: 'basic', amount: 999, currency: 'usd', interval: 'month' }
    ]
  });
}