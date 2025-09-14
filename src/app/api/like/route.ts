import { NextResponse } from 'next/server';
import { extractAnonId } from '@/lib/rtc/auth';

const U = process.env.UPSTASH_REDIS_REST_URL!;
const T = process.env.UPSTASH_REDIS_REST_TOKEN!;

async function upstash(cmd: any[]) {
  const res = await fetch(U, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${T}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([cmd])
  });
  return res.ok ? (await res.json())[0].result : null;
}

// GET /api/like?pairId=... - get like count and mine status
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pairId = url.searchParams.get('pairId');
    
    if (!pairId) {
      return NextResponse.json({ error: 'pairId required' }, { status: 400 });
    }

    const anonId = extractAnonId(req);
    if (!anonId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Get count and check if user has liked
    const [count, mine] = await Promise.all([
      upstash(['HGET', `like:${pairId}`, 'count']),
      upstash(['SISMEMBER', `like:${pairId}:who`, anonId])
    ]);

    return NextResponse.json({
      count: parseInt(count) || 0,
      mine: mine === 1
    });
  } catch (error) {
    console.error('GET /api/like error:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// POST /api/like - like/unlike a pair
export async function POST(req: Request) {
  try {
    const { pairId, action } = await req.json();
    
    if (!pairId || !action || !['like', 'unlike'].includes(action)) {
      return NextResponse.json({ error: 'pairId and action (like/unlike) required' }, { status: 400 });
    }

    const anonId = extractAnonId(req);
    if (!anonId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let newCount = 0;
    let mine = false;

    if (action === 'like') {
      // Check if already liked
      const alreadyLiked = await upstash(['SISMEMBER', `like:${pairId}:who`, anonId]);
      
      if (alreadyLiked !== 1) {
        // Add to set and increment count
        await Promise.all([
          upstash(['SADD', `like:${pairId}:who`, anonId]),
          upstash(['HINCRBY', `like:${pairId}`, 'count', 1])
        ]);
        mine = true;
      } else {
        mine = true;
      }
      
      // Get updated count
      const count = await upstash(['HGET', `like:${pairId}`, 'count']);
      newCount = parseInt(count) || 0;
      
    } else { // unlike
      // Check if currently liked
      const isLiked = await upstash(['SISMEMBER', `like:${pairId}:who`, anonId]);
      
      if (isLiked === 1) {
        // Remove from set and decrement count (bounded at 0)
        await upstash(['SREM', `like:${pairId}:who`, anonId]);
        
        const currentCount = await upstash(['HGET', `like:${pairId}`, 'count']);
        const current = parseInt(currentCount) || 0;
        
        if (current > 0) {
          await upstash(['HINCRBY', `like:${pairId}`, 'count', -1]);
          newCount = current - 1;
        } else {
          newCount = 0;
        }
        mine = false;
      } else {
        // Get current count
        const count = await upstash(['HGET', `like:${pairId}`, 'count']);
        newCount = parseInt(count) || 0;
        mine = false;
      }
    }

    return NextResponse.json({
      count: newCount,
      mine,
      action
    });
  } catch (error) {
    console.error('POST /api/like error:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}