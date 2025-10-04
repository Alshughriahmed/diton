export const revalidate = 0;
import { NextResponse } from 'next/server';
import { withReqId } from "@/lib/http/withReqId";

export async function POST() {
  return withReqId(NextResponse.json({ message: 'Portal endpoint' }));
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
