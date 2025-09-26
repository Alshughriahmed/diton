import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });
}