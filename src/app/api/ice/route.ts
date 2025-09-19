import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(){
  const turnUrl=process.env.TURN_URL||""; const turnUsername=process.env.TURN_USERNAME||""; const turnPassword=process.env.TURN_PASSWORD||"";
  const stun={urls:["stun:stun.l.google.com:19302"]};
  const iceServers=turnUrl&&turnUsername&&turnPassword ? [stun,{urls:[turnUrl],username:turnUsername,credential:turnPassword}] : [stun];
  return NextResponse.json({ iceServers });
}export const runtime="nodejs";
