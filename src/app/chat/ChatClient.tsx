"use client";
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { initLocalMedia, getLocalStream, toggleMic, toggleCam, switchCamera } from "@/lib/media";
import { getFilters, setFilters, type GenderOpt } from "@/utils/filters";
import ChatComposer from "@/components/chat/ChatComposer";

type MatchEcho={ ts:number; gender:string; countries:string[] };

export default function ChatClient(){
  const { next, prev } = useNextPrev();
  const localRef = useRef<HTMLVideoElement>(null);
  const [ready,setReady]=useState(false);
  const [like,setLike]=useState(false);
  const [myLikes,setMyLikes]=useState(0);
  const [peerLikes,setPeerLikes]=useState(123);
  const [vip,setVip]=useState(false);
  const [match,setMatch]=useState<MatchEcho|null>(null);
  const [gender,setGender]=useState<GenderOpt>(getFilters().gender);
  const [countries,setCountries]=useState<string[]>(getFilters().countries);
  const [beauty,setBeauty]=useState(false);

  useKeyboardShortcuts();

  useEffect(()=>{
    let off1=on("ui:toggleMic",()=>{ toggleMic(); });
    let off2=on("ui:toggleCam",()=>{ toggleCam(); });
    let off3=on("ui:openSettings",()=>{ /* open settings modal placeholder */ });
    let off4=on("ui:like",()=>{ setLike(v=>!v); setMyLikes(v=> v?Math.max(0,v-1):v+1 ); });
    let off5=on("ui:report",()=>{ /* open report modal placeholder */ });
    let off6=on("ui:next",()=>{ next(); doMatch(); });
    let off7=on("ui:prev",()=>{ prev(); doMatch(true); });
    initLocalMedia().then(()=>{
      const s=getLocalStream(); if(localRef.current&&s){ localRef.current.srcObject=s; localRef.current.muted=true; localRef.current.play().catch(()=>{}); }
      setReady(true);
    }).catch(()=>{});
    fetch("/api/user/vip-status").then(r=>r.json()).then(j=> setVip(!!j.isVip)).catch(()=>{});
    return ()=>{ off1();off2();off3();off4();off5();off6();off7(); };
  },[]);

  useEffect(()=>{ setFilters({gender,countries}); },[gender,countries]);

  async function doMatch(backward=false){
    const qp=new URLSearchParams(); qp.set("gender",gender); if(countries.length) qp.set("countries", countries.join(","));
    const j:MatchEcho=await fetch("/api/match/next?"+qp.toString(),{cache:"no-store"}).then(r=>r.json()).catch(()=>null as any);
    if(j) setMatch(j);
  }

  // Gesture swipe: يسار/يمين = Prev/Next
  useEffect(()=>{
    let sx=0, sy=0, dx=0, dy=0;
    const start=(e:TouchEvent)=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; };
    const move=(e:TouchEvent)=>{ const t=e.touches[0]; dx=t.clientX-sx; dy=t.clientY-sy; };
    const end=()=>{ if(Math.abs(dx)>80 && Math.abs(dy)<60){ if(dx<0) emit("ui:next"); else emit("ui:prev"); } sx=sy=dx=dy=0; };
    const el=document.getElementById("gesture-layer"); if(!el) return;
    el.addEventListener("touchstart",start,{passive:true}); el.addEventListener("touchmove",move,{passive:true}); el.addEventListener("touchend",end);
    return ()=>{ el.removeEventListener("touchstart",start); el.removeEventListener("touchmove",move); el.removeEventListener("touchend",end); };
  },[]);

  function toggleCountry(code:string){ setCountries(prev => prev.includes(code)? prev.filter(c=>c!==code) : [...prev,code]); }
  const allCountries=[ "US","DE","FR","GB","TR","AE","SA","EG","JO","IQ","SY","LB","MA","ZA","BR","AR","ES","IT","SE","NO","RU","CN","JP","KR","IN","PK","BD","ID","PH","TH","VN","IR","CA","AU","NZ" ];

  return (
    <div className="min-h-screen h-screen w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
      <div className="h-full grid grid-rows-2 gap-2 p-2">
        {/* ===== Top (peer) ===== */}
        <section className="relative rounded-2xl bg-black/30 overflow-hidden">
          {/* Top-left: avatar + likes + VIP */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-500" aria-label="Peer avatar" />
            <span className="px-2 py-0.5 rounded-full bg-rose-600/20 border border-rose-500 text-xs">♥ {peerLikes}</span>
            {vip && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-xs">VIP</span>}
          </div>
          {/* Top-right: FilterBar (countries + gender) */}
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <div className="relative">
              <details className="group">
                <summary className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-600 text-xs cursor-pointer">🌐 Countries ({countries.length||"0"})</summary>
                <div className="absolute right-0 mt-2 w-64 max-h-64 overflow-auto rounded-xl bg-slate-900/95 border border-slate-700 p-2 space-y-1">
                  <input placeholder="Search…" className="w-full mb-2 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs outline-none" onChange={(e)=>{
                    const q=e.target.value.toLowerCase(); document.querySelectorAll<HTMLButtonElement>("[data-cc]").forEach(b=>{ b.style.display=b.dataset.cc!.includes(q)?"":"none"; });
                  }}/>
                  <div className="grid grid-cols-3 gap-1">
                    {allCountries.map(c=>(
                      <button key={c} data-cc={c.toLowerCase()} onClick={(e)=>{e.preventDefault(); toggleCountry(c);}}
                        className={"text-xs px-2 py-1 rounded border "+(countries.includes(c)?"bg-emerald-700/40 border-emerald-500":"bg-slate-800 border-slate-700")}>{c}</button>
                    ))}
                  </div>
                </div>
              </details>
            </div>
            <div className="relative">
              <details className="group">
                <summary className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-600 text-xs cursor-pointer">Gender: {gender[0].toUpperCase()+gender.slice(1)}</summary>
                <div className="absolute right-0 mt-2 w-40 rounded-xl bg-slate-900/95 border border-slate-700 p-1">
                  {(["all","male","female","couple","lgbt"] as GenderOpt[]).map(g=>(
                    <button key={g} className={"w-full text-left text-xs px-2 py-1 rounded "+(gender===g?"bg-emerald-700/40":"hover:bg-slate-800")}
                      onClick={(e)=>{e.preventDefault(); setGender(g);}}>{g[0].toUpperCase()+g.slice(1)}</button>
                  ))}
                </div>
              </details>
            </div>
          </div>
          {/* Bottom-left: peer meta */}
          <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-slate-800/70 border border-slate-600">{match?.countries?.[0]||"—"}</span>
            <span className="px-2 py-1 rounded-full bg-slate-800/70 border border-slate-600">{/* city placeholder */}City</span>
            <span className="px-2 py-1 rounded-full bg-slate-800/70 border border-slate-600">{(match?.gender||"all").toUpperCase()}</span>
          </div>
          {/* Bottom-right intentionally empty */}
          {/* Center remote area */}
          <div className="absolute inset-0 flex items-center justify-center text-slate-300/80 text-sm select-none">
            Remote peer area (states: connecting/matched/…)
          </div>
        </section>

        {/* ===== Bottom (me) ===== */}
        <section className="relative rounded-2xl bg-black/20 overflow-hidden">
          {/* Local preview fills bottom half */}
          <video data-local-video ref={localRef} className="w-full h-full object-cover" playsInline />
          {!ready && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Requesting camera/mic…</div>}

          {/* Top-right user controls */}
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <button aria-label="Switch Camera" className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-600 text-xs"
              onClick={async (e)=>{e.preventDefault(); const s=await switchCamera(); if(localRef.current&&s){localRef.current.srcObject=s; localRef.current.play().catch(()=>{});} }}>↺</button>
            <button aria-label="Beauty" className={"px-3 py-1.5 rounded-full border text-xs "+(beauty?"bg-fuchsia-700/30 border-fuchsia-500":"bg-slate-800/80 border-slate-600")}
              onClick={(e)=>{e.preventDefault(); setBeauty(v=>!v);}}>✨</button>
            {vip && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-xs">VIP</span>}
          </div>

          {/* Chat Composer with Emoji */}
          <div className="absolute inset-x-0 bottom-14">
            <ChatComposer onSend={(message) => {
              console.log('Message sent:', message);
              // TODO: إرسال الرسالة عبر WebRTC أو Socket.io
            }} />
          </div>

          {/* Bottom toolbar: Prev | middle controls | Next */}
          <div className="absolute inset-x-2 bottom-2">
            <div className="flex items-center justify-between gap-2">
              <button aria-label="Prev" className="px-5 py-2 rounded-full bg-neutral-800 text-white text-sm border border-neutral-700"
                onClick={(e)=>{e.preventDefault(); emit("ui:prev");}}>⏮️ Prev</button>
              <div className="flex items-center gap-2">
                <button aria-label="Mic" className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700" onClick={(e)=>{e.preventDefault(); emit("ui:toggleMic");}}>🎙️</button>
                <button aria-label="Camera" className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700" onClick={(e)=>{e.preventDefault(); emit("ui:toggleCam");}}>📷</button>
                <button aria-label="Speaker" className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700">🔊</button>
                <button aria-label="Settings" className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700" onClick={(e)=>{e.preventDefault(); emit("ui:openSettings");}}>⚙️</button>
                <button aria-label="Report" className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700" onClick={(e)=>{e.preventDefault(); emit("ui:report");}}>🛡️</button>
                <button aria-label="Like" className={"px-3 py-2 rounded-lg border "+(like?"bg-rose-600/40 border-rose-400":"bg-neutral-800 border-neutral-700")}
                  onClick={(e)=>{e.preventDefault(); emit("ui:like");}}>♥ {myLikes}</button>
              </div>
              <button aria-label="Next" className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm border border-emerald-500"
                onClick={(e)=>{e.preventDefault(); emit("ui:next");}}>Next ⏭️</button>
            </div>
          </div>

          {/* Gesture layer */}
          <div id="gesture-layer" className="absolute inset-0" />
        </section>
      </div>
    </div>
  );
}