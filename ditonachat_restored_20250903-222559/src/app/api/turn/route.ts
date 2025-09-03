import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TTL = 300; // 5 minutes

// Fallback TURN/STUN servers for development
const fallbackServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { 
    urls: 'turn:turn.example.com:3478',
    username: 'fallback-user',
    credential: 'fallback-pass'
  }
];

export async function GET() {
  try {
    // Try to get real TURN credentials from environment
    const turnUrl = process.env.TURN_URL;
    const turnUser = process.env.TURN_USERNAME;
    const turnPass = process.env.TURN_PASSWORD;
    
    if (turnUrl && turnUser && turnPass) {
      return NextResponse.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: turnUrl,
            username: turnUser,
            credential: turnPass
          }
        ],
        ttl: TTL
      });
    }
    
    // Return fallback servers
    return NextResponse.json({
      iceServers: fallbackServers,
      ttl: TTL
    });
    
  } catch (error) {
    console.error('TURN API error:', error);
    return NextResponse.json({
      iceServers: fallbackServers,
      ttl: TTL
    });
  }
}