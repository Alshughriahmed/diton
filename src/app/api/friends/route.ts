export const revalidate = 0;
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";

// Mock friends data for demo
const mockFriends = [
  { id: "friend1", name: "Alex", avatar: "A", status: "online", mutualLikes: 15 },
  { id: "friend2", name: "Jordan", avatar: "J", status: "offline", mutualLikes: 8 },
  { id: "friend3", name: "Casey", avatar: "C", status: "online", mutualLikes: 23 },
];

export async function GET() {
  // استرجع مصفوفة عرض فقط من LIKES المؤقتة
  return withReqId(NextResponse.json({ friends: mockFriends }));
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
