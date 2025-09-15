"use client";
import { useEffect, useState } from "react";
import { on } from "@/utils/events";

export default function LikeHud(){
  const [pair,setPair]=useState<string|null>(null);
  const [count,setCount]=useState<number>(0);
  useEffect(()=>{
    const onPair = (e:any) => setPair(e?.pairId || e?.id || null);
    const onLike = (p:any) => setCount(typeof p?.myLikes === 'number' ? p.myLikes : (typeof p?.count === 'number' ? p.count : 0));
    const offPair = on('rtc:pair', onPair);
    const offLike = on('ui:likeUpdate', onLike);
    return () => {
      offPair();
      offLike();
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