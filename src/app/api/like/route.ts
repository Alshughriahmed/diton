import { NextRequest, NextResponse } from "next/server";

// In-memory storage for demo (replace with actual database)
let LIKES: Array<{from:string;to:string;ts:number}> = [];

export async function POST(req: NextRequest) {
  try {
    const { from, to } = await req.json();
    
    if (!from || !to) {
      return NextResponse.json({ error: "Missing from or to" }, { status: 400 });
    }
    
    LIKES.push({from, to, ts: Date.now()});
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { from, to } = await req.json();
    
    if (!from || !to) {
      return NextResponse.json({ error: "Missing from or to" }, { status: 400 });
    }
    
    LIKES = LIKES.filter(x => !(x.from === from && x.to === to));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ likes: LIKES, total: LIKES.length });
}