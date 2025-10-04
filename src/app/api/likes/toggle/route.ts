export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { withReqId } from "@/lib/http/withReqId";

export async function POST(req: NextRequest) {
  try {
    const { liked } = await req.json();
    
    // Mock response - in production this would save to database
    const response = {
      success: true,
      myLikes: Math.floor(Math.random() * 100) + (liked ? 1 : 0),
      peerLikes: Math.floor(Math.random() * 200),
      isLiked: liked
    };
    
    return withReqId(NextResponse.json(response));
  } catch (error) {
    return withReqId(NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    ));
  }
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
