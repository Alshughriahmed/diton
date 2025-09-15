"use client";
import { useEffect, useState } from "react";
import { busOn, busOff } from "../../utils/bus";

export default function LikeHud(){
  const [pair,setPair]=useState<string|null>(null);
  const [count,setCount]=useState<number>(0);
  useEffect(()=>{
    const onPair = (e:any) => setPair(e?.pairId || e?.id || null);
    const onLike = (p:any) => setCount(typeof p?.count === 'number' ? p.count : 0);
    busOn('rtc:pair', onPair);
    busOn('like:update', onLike);
    return () => {
      busOff('rtc:pair', onPair);
      busOff('like:update', onLike);
    };
  },[]);
  return (
    <div className="pointer-events-none fixed left-2 top-2 z-[60] select-none">
      <div className="rounded-full bg-black/60 text-white text-xs px-3 py-1">
        <span>♥ {count}</span>{pair? <span className="opacity-60"> · {pair.slice(0,8)}</span>:null}
      </div>
    </div>
  );
}