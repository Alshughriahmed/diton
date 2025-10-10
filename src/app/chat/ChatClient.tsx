"use client";
import safeFetch from '@/app/chat/safeFetch';
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
// startRtcFlowOnce guard marker

import "./freeForAllBridge";
import "./dcMetaResponder.client";

import "./likeSyncClient";
import './msgSendClient';
if (process.env.NODE_ENV !== 'production') {
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (e)=>{
      const r=e.reason; const msg=String((r&&r.message)||'');
      if ((r&&r.name==='AbortError') || /aborted/i.test(msg)) e.preventDefault();
    });
  }
}
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import * as rtc from "./rtcFlow";
import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import { useHydrated } from "@/hooks/useHydrated";
import { initLocalMedia, getLocalStream, toggleMic, toggleCam, switchCamera } from "@/lib/media";
import { useFilters } from "@/state/filters";
import { useFFA } from "@/lib/useFFA";
import { useRouter } from "next/navigation";
import type { GenderOpt } from "@/utils/filters";
import ChatComposer from "@/components/chat/ChatComposer";
import LikeSystem from "@/components/chat/LikeSystem";
import PeerInfoCard from "@/components/chat/PeerInfoCard";
import PeerMetadata from "@/components/chat/PeerMetadata";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import LikeHud from "./LikeHud";
// import QueueBadge from "@/components/chat/QueueBadge"; // Hidden per requirements
import { getMobileOptimizer } from "@/lib/mobile";
import { toast } from "@/lib/ui/toast";
import { nextMatch, tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

type MatchEcho={ ts:number; gender:string; countries:string[] };

const NEXT_COOLDOWN_MS = 700;

// Auto-start will be handled after hydration and media initialization

export default function ChatClient(){
  const ffa = useFFA();
  const router = useRouter();
  
  function __updatePeerBadges(meta:any){
    try{
      if(!meta || typeof document==="undefined") return;
      const g = document.querySelector('[data-ui="peer-gender"]');
      const ctry = document.querySelector('[data-ui="peer-country"]');
      const cty = document.querySelector('[data-ui="peer-city"]');
      if(g) (g as HTMLElement).textContent = meta.gender ? String(meta.gender) : '—';
      if(ctry) (ctry as HTMLElement).textContent = meta.country ? String(meta.country) : '—';
      if(cty) (cty as HTMLElement).textContent = meta.city ? String(meta.city) : '';
    }catch{}
  }

  // Peer meta state for real-time updates
  const [peerMeta, setPeerMeta] = useState<any>(null);
  
  // Listen for ditona:peer-meta-ui events
  useEffect(() => {
    const handleMetaUI = (event: any) => {
      try {
        const meta = event.detail;
        if (meta) {
          setPeerMeta(meta);
          __updatePeerBadges(meta);
          console.log('UI_META', meta);
        }
      } catch {}
    };
    
    if (typeof window !== "undefined") {
      window.addEventListener('ditona:peer-meta-ui', handleMetaUI);
      return () => window.removeEventListener('ditona:peer-meta-ui', handleMetaUI);
    }
  }, []);

  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();
  const lastTsRef = useRef(0);
  const busyRef = useRef(false);
  const lastNextTsRef = useRef(0);
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
  const [rtcPhase, setRtcPhase] = useState<'idle' | 'searching' | 'matched' | 'connected' | 'stopped'>('idle');
  const [phase, setPhase] = useState<'idle'|'searching'|'matched'|'connected'>('idle');
  const [pair, setPair] = useState<{id?:string, role?:'caller'|'callee'}>({});
  const [remoteInfo, setRemoteInfo] = useState<{name?:string; likes?:number; country?:string; city?:string; gender?:string}>({});
  const [isMirrored, setIsMirrored] = useState(true); // MIRROR_DEFAULT=1
  const [peerInfo, setPeerInfo] = useState({
    name: "Anonymous",
    isVip: false,
    likes: 0,
    isOnline: true,
    country: "",
    city: "", 
    gender: "",
    age: 0
  });
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>('');

  // Light pinning when pair.id changes
  useEffect(() => { 
    if (!pair.id) return;
    safeFetch(`/api/like?pairId=${encodeURIComponent(pair.id)}`, { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && typeof j.isLiked === 'boolean') setLike(!!j.isLiked); })
      .catch(() => {});
  }, [pair.id]);

  useKeyboardShortcuts();
  useGestures();

  // Auto-start effect with geo prefetch - runs once after hydration and media
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    
    // Check if already done
    if ((window as any).__ditonaAutostartDone) return;
    (window as any).__ditonaAutostartDone = 1;

    const doAutoStart = async () => {
      try {
        // Prefetch geo data immediately for fast meta info
        const { prefetchGeo } = await import('@/lib/geoCache');
        prefetchGeo();
        console.log('[auto-start] Geo prefetch initiated');
        
        // Wait a bit for media to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Initialize media first if not already done
        const stream = await initLocalMedia();
        if (stream && localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current.play().catch(() => {});
        }

        // Start RTC after ensuring media is ready
        await new Promise(resolve => setTimeout(resolve, 200));
        window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "boot" } }));
        
        // Required sequence: age/allow ⇒ anon/init ⇒ emit("ui:next")
        try {
          const opts = { method: "POST", credentials: "include" as RequestCredentials, cache: "no-store" as RequestCache };
          await safeFetch("/api/age/allow", opts);
          await safeFetch("/api/anon/init", opts);
        } catch (e) { 
          console.warn("age/allow or anon/init failed", e); 
        }
        
        // Import and emit ui:next
        emit("ui:next"); 
        console.log("AUTO_NEXT: fired");
        
        console.log('[auto-start] Successfully started RTC flow');
      } catch (error) {
        console.warn('[auto-start] Failed:', error);
      }
    };

    // Start auto-start with timeout
    const timeout = setTimeout(() => {
      doAutoStart();
    }, 100);

    return () => clearTimeout(timeout);
  }, [hydrated]);

  useEffect(()=>{
    // Enqueue moved to rtcFlow.ts to avoid duplication
    
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
        // Check if we have a valid pairId from current RTC connection
        const currentPairId = (data && data.pairId) || pair.id;
        const dc = (globalThis as any).__ditonaDataChannel;
        
        if (!currentPairId || (!dc || dc.readyState !== 'open')) {
          toast('لا يوجد اتصال نشط للإعجاب');
          return;
        }

        // Optimistic update
        const newLikeState = !like;
        setLike(newLikeState);
        
        // Send via DataChannel for instant peer update
        const dataChannel = (globalThis as any).__ditonaDataChannel;
        if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify({ t:"like", pairId: currentPairId, liked: newLikeState }));
        }
        
        // Send to backend for persistence
        safeFetch(`/api/like?pairId=${encodeURIComponent(currentPairId)}&op=toggle`, { method:'POST' }).catch(()=>{});
        
        toast(`تم الإعجاب ${newLikeState ? '❤️' : '💔'}`);
      } catch (error) {
        console.warn('Like failed:', error);
      }
    });
    let off6=on("ui:report", async ()=>{ 
      try{ 
        await safeFetch('/api/moderation/report',{method:'POST'}); 
        toast('🚩 تم إرسال البلاغ وجاري الانتقال'); 
      }catch{}
      // RTC bridge: use new flow
      rtc.next();
    });
    let off7=on("ui:next",()=>{ 
      // Next button cooldown/debounce
      const now = Date.now();
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) {
        return; // Ignore rapid consecutive Next button presses
      }
      lastNextTsRef.current = now;
      
      // RTC bridge: use new flow
      rtc.next();
    });
    let off8=on("ui:prev",()=>{ 
      // Use proper previous functionality
      tryPrevOrRandom();
    });
    let offOpenMessaging=on("ui:openMessaging" as any, ()=>{ setShowMessaging(true); });
    let offCloseMessaging=on("ui:closeMessaging" as any, ()=>{ setShowMessaging(false); });
    let offRemoteAudio=on("ui:toggleRemoteAudio" as any, ()=>{
  // حاول أولاً عبر عنصر صوت مستقل إن وُجد
  const a=document.getElementById("remoteAudio") as HTMLAudioElement|null;
  if(a){ a.muted = !a.muted; toast(a.muted ? "🔇 صمت الطرف الثاني" : "🔈 سماع الطرف الثاني"); return; }
  // وإلا بدّل خاصية muted على فيديو الطرف
  const v=document.querySelector('video[data-role="remote"],#remoteVideo') as HTMLVideoElement|null;
  if(v){ v.muted = !v.muted; toast(v.muted ? "🔇 صمت الطرف الثاني" : "🔈 سماع الطرف الثاني"); }
});
let offTogglePlay=on("ui:togglePlay", ()=>{
      setPaused(p => !p);
      toast('تبديل حالة المطابقة');
    });
    let offToggleMasks=on("ui:toggleMasks", ()=>{
      toast('🤡 تفعيل/إلغاء الأقنعة');
    });
    let offMirrorToggle=on("ui:toggleMirror", ()=>{
      setIsMirrored(prev => {
        const newState = !prev;
        toast(newState ? '🪞 تفعيل المرآة' : '📹 إلغاء المرآة');
        return newState;
      });
    });
    let offUpsell=on("ui:upsell", (d:any)=>{
      if (ffa) return; // لا تحويل في وضع FFA
      router.push(`/plans?ref=${d?.ref || d?.feature || 'generic'}`);
    });
    let offCountryFilter=on("filters:country", async (value)=>{
      try {
        // Update user in queue with new filters
        const { useFilters } = await import('@/state/filters');
        const { gender, countries } = useFilters.getState();
        
        await safeFetch('/api/rtc/enqueue', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            gender: 'unknown', // Will be improved with real profile data
            country: 'UNKNOWN', // Will be improved with geo data
            filterGenders: gender === 'all' ? 'all' : gender,
            filterCountries: countries?.length ? countries.join(',') : 'ALL'
          })
        });
      } catch {}
      
      // Trigger new match with updated filters
      rtc.next();
    });
    let offGenderFilterUpdate=on("filters:gender", async (value)=>{
      try {
        // Update user in queue with new filters  
        const { useFilters } = await import('@/state/filters');
        const { gender, countries } = useFilters.getState();
        
        await safeFetch('/api/rtc/enqueue', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            gender: 'unknown', // Will be improved with real profile data
            country: 'UNKNOWN', // Will be improved with geo data
            filterGenders: gender === 'all' ? 'all' : gender,
            filterCountries: countries?.length ? countries.join(',') : 'ALL'
          })
        });
      } catch {}
      
      // Trigger new match with updated filters
      rtc.next();
    });
    
    // Removed duplicate - handlePeerMeta defined below
    
    // RTC event listeners
    let offRtcPhase=on("rtc:phase" as any, (data)=>{
      setPhase(data.phase);
      setRtcPhase(data.phase); // Keep compatibility with existing code
    });
    let offRtcPair=on("rtc:pair" as any, (data)=>{
      setPair({id: data.pairId, role: data.role});
      // Fetch remote profile (placeholder for now)
      setRemoteInfo({
        name: "Partner",
        likes: Math.floor(Math.random() * 500),
        country: "Unknown",
        city: "Unknown",
        gender: "unknown"
      });
    });
    let offRtcRemoteTrack=on("rtc:remote-track" as any, (data)=>{
      const remoteVideo = document.querySelector('#remoteVideo') as HTMLVideoElement;
      if (remoteVideo && data.stream) {
        remoteVideo.srcObject = data.stream;
try{
  const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement|null;
  if(remoteAudio){
    remoteAudio.srcObject = remoteVideo.srcObject as any;
    remoteAudio.muted = false;
    remoteAudio.play?.().catch(()=>{});
  }
}catch{}
        try{ remoteVideo.play?.().catch(()=>{}); }catch{}
      }
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
    
    // Listen for peer metadata updates
    const handlePeerMeta = (e: any) => {
      const meta = e.detail;
      if (meta) {
        // Update peer info state
        setPeerInfo(prev => ({
          ...prev,
          country: meta.country || prev.country,
          gender: meta.gender || prev.gender
        }));
        
        // Update remote info state  
        setRemoteInfo(prev => ({
          ...prev,
          country: meta.country || prev.country,
          gender: meta.gender || prev.gender
        }));
        
        // Update badges immediately
        __updatePeerBadges(meta);
      }
    };
    
    // Add event listener for peer-meta updates
    if (typeof window !== "undefined") {
      window.addEventListener("ditona:peer-meta", handlePeerMeta);
      
      // Listen for peer likes via DataChannel
      window.addEventListener("rtc:peer-like", (e: any) => {
        const detail = e.detail;
        if (detail && typeof detail.liked === 'boolean') {
          setPeerLikes(detail.liked ? 1 : 0);
          toast(`${detail.liked ? 'أعجب' : 'ألغى الإعجاب'} بك الشريك ${detail.liked ? '❤️' : '💔'}`);
        }
      });
    }
    
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
    
    // Permission-aware media initialization
    async function initMediaWithPermissionChecks() {
      try {
        // Check document visibility state
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          setCameraPermissionHint('قم بالعودة إلى التبويب لتفعيل الكاميرا');
          return;
        }
        
        // Clear any existing hints
        setCameraPermissionHint('');
        
        // Try to initialize media
        await initLocalMedia();
        
        // If successful, clear hints and proceed
        setCameraPermissionHint('');
        
      } catch (error: any) {
        console.warn('Media initialization failed:', error);
        
        // Handle specific camera permission/access errors
        if (error?.name === 'NotAllowedError') {
          setCameraPermissionHint('قم بالسماح للكاميرا والميكروفون من إعدادات المتصفح');
        } else if (error?.name === 'NotReadableError' || error?.name === 'AbortError') {
          setCameraPermissionHint('قم بإغلاق التبويب الثاني أو اسمح للكاميرا');
        } else if (error?.name === 'NotFoundError') {
          setCameraPermissionHint('لم يتم العثور على كاميرا أو ميكروفون');
        } else {
          setCameraPermissionHint('خطأ في الوصول للكاميرا - تأكد من الأذونات');
        }
        return;
      }
    }
    
    initMediaWithPermissionChecks().then(async ()=>{
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
        
        // Start RTC matchmaking after media is ready
        if (localRef.current?.srcObject) {
        const _m = await rtc.start(localRef.current.srcObject as MediaStream, setRtcPhase).catch(()=>undefined);
       // _m قد يحوي {pairId, role}. التدفق الحالي يضبط setRtcPhase('matched') داخليًا.
      }
      }
      setReady(true);
    }).catch(()=>{});
    safeFetch("/api/user/vip-status").then(r=>r.json()).then(j=> { 
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
      offRemoteAudio();offTogglePlay();offToggleMasks();offUpsell();offGenderFilterUpdate();offCountryFilter();offOpenMessaging();offCloseMessaging();offMirrorToggle();
      offRtcPhase();offRtcPair();offRtcRemoteTrack();
      // Cleanup event listeners
      if (typeof window !== "undefined") {
        window.removeEventListener("ditona:peer-meta", handlePeerMeta);
        // Remove peer-like listener if needed
      }
      unsubscribeMobile(); 
    };
  },[]);
useEffect(() => () => { try { rtc.stop(); } catch {} }, []);



  async function doMatch(backward=false){
    // RTC bridge: disable legacy matcher
    return;
    const now = Date.now();
    if (busyRef.current) return;
    if (now - lastTsRef.current < 700) return;
    busyRef.current = true;
    lastTsRef.current = now;
    const qp=new URLSearchParams(); qp.set("gender",gender); if(countries.length) qp.set("countries", countries.join(","));
      const __mg = (typeof window!=="undefined" && window.localStorage) ? window.localStorage.getItem("ditona_myGender") : null;
      const __geo = (typeof window!=="undefined" && window.localStorage) ? (window.localStorage.getItem("ditona_geo") || window.localStorage.getItem("ditona_geo_hint")) : null;
    const j:MatchEcho=await safeFetch("/api/match/next?"+qp.toString(), { cache:"no-store", headers: { "x-ditona-my-gender": (__mg||""), "x-ditona-geo": (__geo||"") } }).then(r=>r.json()).catch(()=>null as any);
    if(j) setMatch(j);
    busyRef.current = false;
  }

  // Enhanced gesture swipe with feedback
  useEffect(()=>{
    let x0=0, y0=0, moved=false;
    const down=(e:PointerEvent)=>{ x0=e.clientX; y0=e.clientY; moved=false; };
    const up=(e:PointerEvent)=>{
      const dx=e.clientX-x0, dy=e.clientY-y0;
      if(Math.abs(dx) > 60 && Math.abs(dy) < 60 && Math.abs(dx) > Math.abs(dy)){
        if(dx<0) {
          toast('⏭️ سحب للمطابقة التالية');
          emit('ui:next'); 
        } else {
          // Use unified FFA hook instead of deprecated window.__vip
          if (ffa) console.log("FFA_FORCE: enabled");
          if (!vip && !ffa) {
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

  // === Legacy RTC helpers removed - now using rtcFlow.ts ===

  function toggleCountry(code:string){ 
    const newCountries = countries.includes(code) ? countries.filter(c=>c!==code) : [...countries,code];
    setCountries(newCountries);
  }
  const allCountries=[ "US","DE","FR","GB","TR","AE","SA","EG","JO","IQ","SY","LB","MA","ZA","BR","AR","ES","IT","SE","NO","RU","CN","JP","KR","IN","PK","BD","ID","PH","TH","VN","IR","CA","AU","NZ" ];

  if (!hydrated) {
    return (
      <div className="min-h-screen h-screen w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
      <FilterBar />
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
    <>
      <LikeHud />
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
          
          {/* Queue Badge - Hidden per requirements */}
          
          {/* Filters - Top Right (NEW POSITIONING) */}
          <FilterBar />
          
          {/* HUD - آخر 3 رسائل */}
          <MessageHud />
          
          {/* Like System - Bottom Right */}
          <div className="absolute bottom-4 right-4 z-30">
            <LikeSystem />
          </div>
          
          {/* Remote video */}
          <video 
            id="remoteVideo" 
            data-role="remote" 
            className="w-full h-full object-cover" 
            playsInline 
            autoPlay
            
          />
          
          {/* Center remote area overlay - only show during searching */}
          {rtcPhase === 'searching' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
              <div className="mb-4">Searching for a partner…</div>
              <button
                onClick={() => {
                  try {
                    rtc.stop();
                    toast('🛑 تم إلغاء البحث');
                  } catch (error) {
                    console.warn('Cancel failed:', error);
                  }
                }}
                className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* ===== Bottom (me) ===== */}
        <section className="relative rounded-2xl bg-black/20 overflow-hidden">
          {/* Local preview fills bottom half */}
          <video 
            data-local-video 
            ref={localRef} 
            className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
            playsInline 
          />
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm text-center px-4">
              {cameraPermissionHint ? (
                <>
                  <div className="mb-2 text-yellow-400">⚠️</div>
                  <div className="mb-4">{cameraPermissionHint}</div>
                  <button
                    onClick={() => {
                      setCameraPermissionHint('');
                      // Retry media initialization
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
                          
                         // Start RTC matchmaking after media is ready
                        if (localRef.current?.srcObject) {
                         const m = await rtc
                         .start(localRef.current.srcObject as MediaStream, setRtcPhase)
                         .catch(() => undefined);

                          if (m?.pairId && m?.role) {
                         window.dispatchEvent(new CustomEvent("rtc:matched", { detail: m }));
                        }
                     }

                                  setReady(true);
                      }).catch((error) => {
                     console.warn("Retry failed:", error);
                  if (error?.name === "NotAllowedError") {
                setCameraPermissionHint("قم بالسماح للكاميرا والميكروفون من إعدادات المتصفح");
              } else if (error?.name === "NotReadableError" || error?.name === "AbortError") {
                  setCameraPermissionHint("قم بإغلاق التبويب الثاني أو اسمح للكاميرا");
             } else {
               setCameraPermissionHint("خطأ في الوصول للكاميرا - تأكد من الأذونات");
               }
                 });


          {/* My Controls - Top Right */}
          <MyControls />

          {/* No enhanced message system - replaced by stub */}

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
    </>
  );
}
