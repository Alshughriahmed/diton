"use client";
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useHydrated } from "@/hooks/useHydrated";
import { initLocalMedia, getLocalStream, toggleMic, toggleCam, switchCamera } from "@/lib/media";
import { useFilters } from "@/state/filters";
import type { GenderOpt } from "@/utils/filters";
import ChatComposer from "@/components/chat/ChatComposer";
import LikeSystem from "@/components/chat/LikeSystem";
import MessageSystem from "@/components/chat/MessageSystem";
import RemoteTopRight from "@/components/chat/RemoteTopRight";
import PeerInfoCard from "@/components/chat/PeerInfoCard";
import PeerMetadata from "@/components/chat/PeerMetadata";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "@/components/chat/ChatToolbar";
import ChatMessagingBar from "@/components/chat/ChatMessaging";
import QueueBadge from "@/components/chat/QueueBadge";
import { getMobileOptimizer } from "@/lib/mobile";
import { toast } from "@/lib/ui/toast";
import { nextMatch, tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

type MatchEcho={ ts:number; gender:string; countries:string[] };

export default function ChatClient(){
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();
  const lastTsRef = useRef(0);
  const busyRef = useRef(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const [ready,setReady]=useState(false);
  const [like,setLike]=useState(false);
  const [myLikes,setMyLikes]=useState(0);
  const [peerLikes,setPeerLikes]=useState(123);
  const [match,setMatch]=useState<MatchEcho|null>(null);
  const { gender, countries, setGender, setCountries, isVip: vip, setVip } = useFilters();
  const [beauty,setBeauty]=useState(false);
  const [effectsStream, setEffectsStream] = useState<MediaStream | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const { profile } = useProfile();
  const [peerInfo, setPeerInfo] = useState({
    name: "Anonymous",
    isVip: Math.random() > 0.7,
    likes: Math.floor(Math.random() * 500),
    isOnline: true,
    country: "US",
    city: "New York", 
    gender: "female",
    age: 24
  });

  useKeyboardShortcuts();

  useEffect(()=>{
    // Enqueue on mount
    fetch("/api/rtc/enqueue",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({anonId:typeof window!=="undefined"?localStorage.getItem("ditona_anon"):"" })}).catch(()=>{});
    
    let off1=on("ui:toggleMic",()=>{ toggleMic(); });
    let off2=on("ui:toggleCam",()=>{ toggleCam(); });
    let off3=on("ui:switchCamera",async ()=>{ 
      try {
        const newStream = await switchCamera();
        if(localRef.current && newStream) {
          localRef.current.srcObject = newStream;
          localRef.current.play().catch(()=>{});
        }
      } catch(error) {
        console.warn('Camera switch failed:', error);
      }
    });
    let off4=on("ui:openSettings",()=>{ try{ window.location.href='/settings'; }catch{} });
    let off5=on("ui:like", async (data)=>{ 
      try {
        // Send like to backend
        const response = await fetch('/api/likes/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liked: data?.isLiked || true })
        });
        
        if (response.ok) {
          const result = await response.json();
          setLike(data?.isLiked || false); 
          setMyLikes(result.myLikes || data?.myLikes || 0);
          
          // Update LikeSystem component
          emit("ui:likeUpdate", {
            myLikes: result.myLikes || data?.myLikes || 0,
            peerLikes: result.peerLikes || peerLikes,
            isLiked: data?.isLiked || false,
            canLike: true
          });
          
          toast(`تم الإعجاب ${data?.isLiked ? '❤️' : '💔'}`);
        } else {
          toast('خطأ في إرسال الإعجاب');
        }
      } catch (error) {
        console.warn('Like failed:', error);
        // Fallback to local update
        setLike(data?.isLiked || false); 
        setMyLikes(data?.myLikes || 0);
        emit("ui:likeUpdate", {
          myLikes: data?.myLikes || 0,
          peerLikes: peerLikes,
          isLiked: data?.isLiked || false,
          canLike: true
        });
      }
    });
    let off6=on("ui:report", async ()=>{ 
      try{ 
        await fetch('/api/moderation/report',{method:'POST'}); 
        toast('🚩 تم إرسال البلاغ وجاري الانتقال'); 
      }catch{}
      nextMatch({gender, countries});
    });
    let off7=on("ui:next",()=>{ 
      nextMatch({gender, countries});
      fetch("/api/rtc/enqueue",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({anonId:typeof window!=="undefined"?localStorage.getItem("ditona_anon"):"" })}).catch(()=>{});
    });
    let off8=on("ui:prev",()=>{ tryPrevOrRandom({gender, countries}); });
    let offOpenMessaging=on("ui:openMessaging" as any, ()=>{ setShowMessaging(true); });
    let offCloseMessaging=on("ui:closeMessaging" as any, ()=>{ setShowMessaging(false); });
    let offRemoteAudio=on("ui:toggleRemoteAudio", ()=>{
      const v=document.querySelector('video[data-role="remote"],#remoteVideo') as HTMLVideoElement|null;
      if(v){ v.muted = !v.muted; toast(v.muted?'🔇 صمت الطرف الثاني':'🔈 سماع الطرف الثاني'); }
    });
    let offTogglePlay=on("ui:togglePlay", ()=>{
      setPaused(p => !p);
      toast('تبديل حالة المطابقة');
    });
    let offToggleMasks=on("ui:toggleMasks", ()=>{
      toast('🤡 تفعيل/إلغاء الأقنعة');
    });
    let offUpsell=on("ui:upsell", (feature)=>{
      const freeForAll = process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1";
      if (freeForAll) {
        // In free mode, don't show upsell, just show notification
        toast(`🔒 ميزة ${feature} حصرية لـ VIP`);
        return;
      }
      setShowUpsell(true);
      toast(`🔒 ميزة ${feature} حصرية لـ VIP`);
    });
    let offCountryFilter=on("filters:country", (value)=>{
      // Trigger new match with updated filters
      doMatch();
    });
    let offGenderFilterUpdate=on("filters:gender", (value)=>{
      // Trigger new match with updated filters  
      doMatch();
    });
    let off9=on("ui:toggleBeauty",async (data)=>{ 
      try {
        if (typeof window !== 'undefined') {
          const { getVideoEffects } = await import("@/lib/effects");
          const effects = getVideoEffects();
          if (effects) {
            effects.updateConfig({ beauty: { enabled: data.enabled, ...data.settings } });
            setBeauty(data.enabled);
          }
        }
      } catch(error) {
        console.warn('Beauty toggle failed:', error);
      }
    });
    let off10=on("ui:updateBeauty",async (data)=>{ 
      try {
        if (typeof window !== 'undefined') {
          const { getVideoEffects } = await import("@/lib/effects");
          const effects = getVideoEffects();
          if (effects) {
            effects.updateConfig({ beauty: { enabled: beauty, ...data.settings } });
          }
        }
      } catch(error) {
        console.warn('Beauty update failed:', error);
      }
    });
    let off11=on("ui:changeMask",async (data)=>{ 
      try {
        if (typeof window !== 'undefined') {
          const { getVideoEffects } = await import("@/lib/effects");
          const effects = getVideoEffects();
          if (effects) {
            effects.updateConfig({ mask: { enabled: data.type !== 'none', type: data.type } });
          }
        }
      } catch(error) {
        console.warn('Mask change failed:', error);
      }
    });
    
    initLocalMedia().then(async ()=>{
      const s=getLocalStream(); 
      if(localRef.current && s){ 
        // Initialize effects if VIP or beauty enabled
        if (vip && typeof window !== 'undefined') {
          try {
            const { getVideoEffects } = await import("@/lib/effects");
            const effects = getVideoEffects();
            if (effects) {
              const video = document.createElement('video');
              video.srcObject = s;
              video.play();
              
              const processedStream = await effects.initialize(video);
              if (processedStream) {
                setEffectsStream(processedStream);
                localRef.current.srcObject = processedStream;
                effects.start();
              } else {
                localRef.current.srcObject = s;
              }
            } else {
              localRef.current.srcObject = s;
            }
          } catch (error) {
            console.warn('Effects initialization failed, using original stream:', error);
            localRef.current.srcObject = s;
          }
        } else {
          localRef.current.srcObject = s;
        }
        
        localRef.current.muted = true; 
        localRef.current.play().catch(()=>{}); 
      }
      setReady(true);
    }).catch(()=>{});
    fetch("/api/user/vip-status").then(r=>r.json()).then(j=> { 
      setVip(!!j.isVip); 
      setIsGuest(!j.user); 
    }).catch(()=>{
      setIsGuest(true);
    });
    
    // Initialize mobile optimizer
    const mobileOptimizer = getMobileOptimizer();
    const unsubscribeMobile = mobileOptimizer.subscribe((viewport) => {
      // Handle viewport changes for mobile optimization
      console.log('Viewport changed:', viewport);
    });
    return ()=>{ 
      off1();off2();off3();off4();off5();off6();off7();off8();off9();off10();off11(); 
      offRemoteAudio();offTogglePlay();offToggleMasks();offUpsell();offGenderFilterUpdate();offCountryFilter();offOpenMessaging();offCloseMessaging();
      unsubscribeMobile(); 
    };
  },[]);


  async function doMatch(backward=false){
    const now = Date.now();
    if (busyRef.current) return;
    if (now - lastTsRef.current < 700) return;
    busyRef.current = true;
    lastTsRef.current = now;
    const qp=new URLSearchParams(); qp.set("gender",gender); if(countries.length) qp.set("countries", countries.join(","));
      const __mg = (typeof window!=="undefined" && window.localStorage) ? window.localStorage.getItem("ditona_myGender") : null;
      const __geo = (typeof window!=="undefined" && window.localStorage) ? (window.localStorage.getItem("ditona_geo") || window.localStorage.getItem("ditona_geo_hint")) : null;
    const j:MatchEcho=await fetch("/api/match/next?"+qp.toString(), { cache:"no-store", headers: { "x-ditona-my-gender": (__mg||""), "x-ditona-geo": (__geo||"") } }).then(r=>r.json()).catch(()=>null as any);
    if(j) setMatch(j);
    busyRef.current = false;
  }

  // Enhanced gesture swipe with feedback
  useEffect(()=>{
    let x0=0, y0=0, moved=false;
    const down=(e:PointerEvent)=>{ x0=e.clientX; y0=e.clientY; moved=false; };
    const up=(e:PointerEvent)=>{
      const dx=e.clientX-x0, dy=e.clientY-y0;
      if(Math.abs(dx) > 60 && Math.abs(dy) < 60){
        if(dx<0) {
          toast('⏭️ سحب للمطابقة التالية');
          emit('ui:next'); 
        } else {
          if (!vip) {
            toast('🔒 العودة للسابق متاحة لـ VIP فقط');
            emit('ui:upsell', 'prev');
          } else {
            toast('⏮️ محاولة العودة للمطابقة السابقة...');
            emit('ui:prev');
          }
        }
      }
    };
    window.addEventListener('pointerdown',down);
    window.addEventListener('pointerup',up);
    return ()=>{
      window.removeEventListener('pointerdown',down);
      window.removeEventListener('pointerup',up);
    };
  },[vip]);

  function toggleCountry(code:string){ 
    const newCountries = countries.includes(code) ? countries.filter(c=>c!==code) : [...countries,code];
    setCountries(newCountries);
  }
  const allCountries=[ "US","DE","FR","GB","TR","AE","SA","EG","JO","IQ","SY","LB","MA","ZA","BR","AR","ES","IT","SE","NO","RU","CN","JP","KR","IN","PK","BD","ID","PH","TH","VN","IR","CA","AU","NZ" ];

  if (!hydrated) {
    return (
      <div className="min-h-screen h-screen w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-slate-300/80 text-sm">
              Loading...
            </div>
          </section>
          <section className="relative rounded-2xl bg-black/20 overflow-hidden pb-28 md:pb-24">
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
              Initializing...
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" data-chat-container>
      <div className="h-full grid grid-rows-2 gap-2 p-2">
        {/* ===== Top (peer) ===== */}
        <section className="relative rounded-2xl bg-black/30 overflow-hidden">
          {/* Peer Info Card - Top Left */}
          <PeerInfoCard peerInfo={peerInfo} />
          
          {/* Peer Metadata - Bottom Left */}
          <PeerMetadata 
            country={peerInfo.country}
            city={peerInfo.city}
            gender={peerInfo.gender}
            age={peerInfo.age}
          />
          
          {/* Queue length badge - Top Right overlay */}
          <div className="absolute top-2 right-2 z-50 pointer-events-none">
            <QueueBadge />
          </div>
          
          {/* Filters - Top Right (below queue badge) */}
          <div className="absolute top-12 right-2 z-40">
            <RemoteTopRight />
          </div>
          
          {/* Like System - Bottom Right */}
          <div className="absolute bottom-4 right-4 z-30">
            <LikeSystem />
          </div>
          
          {/* Center remote area */}
          <div className="absolute inset-0 flex items-center justify-center text-slate-300/80 text-sm select-none">
            جارٍ العثور على شريك دردشة…
          </div>
        </section>

        {/* ===== Bottom (me) ===== */}
        <section className="relative rounded-2xl bg-black/20 overflow-hidden">
          {/* Local preview fills bottom half */}
          <video data-local-video ref={localRef} className="w-full h-full object-cover" playsInline />
          {!ready && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Requesting camera/mic…</div>}

          {/* My Controls - Top Right */}
          <MyControls />

          {/* Enhanced Message System */}
          <div className="absolute inset-x-0 bottom-14">
            <MessageSystem 
              isGuest={isGuest}
              onSend={(message) => {
                console.log('Message sent:', message);
                // TODO: إرسال الرسالة عبر WebRTC أو Socket.io
              }} 
            />
          </div>

          {/* Gesture layer */}
          <div id="gesture-layer" className="absolute inset-0 -z-10" />
        </section>
      </div>
      
      {/* Chat Toolbar */}
      <ChatToolbar />
      
      {/* Upsell Modal */}
      <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
      
      {/* Chat Messaging */}
      <ChatMessagingBar />
    </div>
  );
}