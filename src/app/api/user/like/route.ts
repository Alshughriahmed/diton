export const revalidate = 0;
const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
import { NextRequest, NextResponse } from 'next/server';
import { withReqId } from "@/lib/http/withReqId";
import { getServerSession } from 'next-auth/next';

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }
export const dynamic = 'force-dynamic';

interface LikeData {
  action: 'like' | 'unlike';
  timestamp: number;
  userId?: string;
}

// In-memory storage for demo (replace with actual database)
const userLikes = new Map<string, Set<string>>();
const likeHistory = new Map<string, LikeData[]>();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return withReqId(__noStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 })));
    }

    const userId = session.user.email;
    const body: LikeData = await request.json();

    if (!body.action || !body.timestamp) {
      return withReqId(__noStore(NextResponse.json({ error: 'Invalid request data' }, { status: 400 })));
    }

    // Update like count
    if (!userLikes.has(userId)) {
      userLikes.set(userId, new Set());
    }

    const userLikeSet = userLikes.get(userId)!;
    
    if (body.action === 'like') {
      userLikeSet.add(body.timestamp.toString());
    } else {
      userLikeSet.delete(body.timestamp.toString());
    }

    // Store in history
    if (!likeHistory.has(userId)) {
      likeHistory.set(userId, []);
    }
    
    likeHistory.get(userId)!.push({
      ...body,
      timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (likeHistory.get(userId)!.length > 100) {
      likeHistory.get(userId)!.shift();
    }

    return withReqId(__noStore(NextResponse.json({ 
      success: true,
      totalLikes: userLikeSet.size,
      timestamp: Date.now()
    })));

  } catch (error) {
    console.error('Like API error:', error);
    return withReqId(__noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 })));
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return withReqId(__noStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 })));
    }

    const userId = session.user.email;
    const userLikeSet = userLikes.get(userId) || new Set();
    
    return withReqId(__noStore(NextResponse.json({
      totalLikes: userLikeSet.size,
      history: likeHistory.get(userId) || []
    })));

  } catch (error) {
    console.error('Like GET API error:', error);
    return withReqId(__noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 })));
  }
}
export const runtime="nodejs";
