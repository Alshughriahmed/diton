export const revalidate = 0;
const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export const dynamic = 'force-dynamic';

interface Friend {
  id: string;
  username?: string;
  avatar?: string;
  lastSeen: string;
  isOnline: boolean;
  mutualLikes: number;
  country?: string;
  gender?: string;
  addedAt: number;
}

// In-memory storage for demo (replace with actual database)
const userFriends = new Map<string, Friend[]>();
const friendRequests = new Map<string, Set<string>>();

// Mock data generator
const generateMockFriend = (id: string): Friend => {
  const countries = ['US', 'DE', 'FR', 'GB', 'TR', 'AE', 'SA', 'EG', 'JO'];
  const genders = ['male', 'female', 'couple', 'lgbt'];
  const names = ['Alex', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Quinn'];
  
  return {
    id,
    username: names[Math.floor(Math.random() * names.length)],
    avatar: String.fromCharCode(65 + Math.floor(Math.random() * 26)), // A-Z
    lastSeen: Math.random() > 0.3 ? 'Online' : `${Math.floor(Math.random() * 24)}h ago`,
    isOnline: Math.random() > 0.7,
    mutualLikes: Math.floor(Math.random() * 50) + 1,
    country: countries[Math.floor(Math.random() * countries.length)],
    gender: genders[Math.floor(Math.random() * genders.length)],
    addedAt: Date.now() - Math.floor(Math.random() * 1000000000)
  };
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return __noStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const userId = session.user.email;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'liked';

    // Initialize with mock data if empty
    if (!userFriends.has(userId)) {
      const mockFriends: Friend[] = [];
      
      // Generate some mock friends for demo
      if (Math.random() > 0.5) {
        for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
          mockFriends.push(generateMockFriend(`friend_${i}_${Date.now()}`));
        }
      }
      
      userFriends.set(userId, mockFriends);
    }

    let friends = userFriends.get(userId) || [];

    // Filter based on type (in real app, this would be different tables/relations)
    if (type === 'likedBy') {
      // Simulate friends who liked the user
      friends = friends.filter(() => Math.random() > 0.5);
    }

    // Sort by most recent activity
    friends.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return b.addedAt - a.addedAt;
    });

    return __noStore(NextResponse.json({
      friends,
      total: friends.length,
      online: friends.filter(f => f.isOnline).length
    }));

  } catch (error) {
    console.error('Friends GET API error:', error);
    return __noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return __noStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const userId = session.user.email;
    const { friendId, action } = await request.json();

    if (!friendId || !action) {
      return __noStore(NextResponse.json({ error: 'Invalid request data' }, { status: 400 }));
    }

    if (!userFriends.has(userId)) {
      userFriends.set(userId, []);
    }

    const friends = userFriends.get(userId)!;

    if (action === 'add') {
      // Check if already friends
      if (friends.find(f => f.id === friendId)) {
        return __noStore(NextResponse.json({ error: 'Already friends' }, { status: 400 }));
      }

      // Add new friend
      const newFriend = generateMockFriend(friendId);
      friends.push(newFriend);

      return __noStore(NextResponse.json({ 
        success: true, 
        friend: newFriend,
        message: 'Friend added successfully' 
      }));

    } else if (action === 'remove') {
      const friendIndex = friends.findIndex(f => f.id === friendId);
      if (friendIndex === -1) {
        return __noStore(NextResponse.json({ error: 'Friend not found' }, { status: 404 }));
      }

      friends.splice(friendIndex, 1);
      
      return __noStore(NextResponse.json({ 
        success: true,
        message: 'Friend removed successfully' 
      }));
    }

    return __noStore(NextResponse.json({ error: 'Invalid action' }, { status: 400 }));

  } catch (error) {
    console.error('Friends POST API error:', error);
    return __noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return __noStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const userId = session.user.email;
    const { friendId } = await request.json();

    if (!friendId) {
      return __noStore(NextResponse.json({ error: 'Friend ID required' }, { status: 400 }));
    }

    const friends = userFriends.get(userId) || [];
    const friendIndex = friends.findIndex(f => f.id === friendId);
    
    if (friendIndex === -1) {
      return __noStore(NextResponse.json({ error: 'Friend not found' }, { status: 404 }));
    }

    friends.splice(friendIndex, 1);
    
    return __noStore(NextResponse.json({ 
      success: true,
      message: 'Friend removed successfully'
    }));

  } catch (error) {
    console.error('Friends DELETE API error:', error);
    return __noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}export const runtime="nodejs";
