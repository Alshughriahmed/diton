import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    metrics: {
      activeUsers: 0,
      connections: 0,
      timestamp: new Date().toISOString()
    }
  });
}