"use client";

type NormGender = "m" | "f" | "c" | "l" | "u";
type PeerMeta = {
  pairId?: string; displayName?: string; vip?: boolean; likes?: number; hideLikes?: boolean;
  country?: string; hideCountry?: boolean; city?: string; hideCity?: boolean;
  gender?: NormGender | string; avatarUrl?: string; avatar?: string;
};

function curPair(): string | null { try { const w:any=globalThis as any; return w.__ditonaPairId||w.__pairId||null; } catch { return null; } }
function readCached(): PeerMeta { try { const raw=sessionStorage.getItem("ditona:last_peer_meta"); return raw?JSON.parse(raw):{}; } catch { return {}; } }
function writeCached(m: PeerMeta){ try{sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(m));}catch{} }
function normGender(g: unknown): NormGender{ const s=String(g??"").toLowerCase().trim(); if(s==="m"||s==="male")return"m"; if(s==="f"||s==="female")return"f"; if(s==="c"||s==="couple")return"c"; if(s==="l"||s.startsWith("lgbt"))return"l"; return"u";}
function genderSymbol(g: NormGender){return g==="m"?"♂":g==="f"?"♀":g==="c"?"⚤":g==="l"?"🏳️‍🌈":"";}
function genderColor(g: NormGender){return g==="m"?"text-blue-500":g==="f"?"text-red-500":g==="c"?"text-rose-700":"";}
const qs = (s:string)=>document.querySelector<HTMLElement>(`[data-ui="${s}"]`);

function render(meta: PeerMeta){
  const countryEl=qs("peer-country"), cityEl=qs("peer-city"), genderEl=qs("peer-gender"),
        nameEl=qs("peer-name"), likesEl=qs("peer-likes"), vipEl=qs("peer-vip"),
        avatarEl=qs("peer-avatar") as HTMLImageElement | null;

  if(countryEl) countryEl.textContent = meta.hideCountry ? "" : meta.country || "";
  if(cityEl)    cityEl.textContent    = meta.hideCity    ? "" : meta.city    || "";

  if(genderEl){
    const g = normGender(meta.gender);
    genderEl.textContent = genderSymbol(g);
    genderEl.classList.remove("text-blue-500","text-red-500","text-rose-700","text-transparent","bg-clip-text","bg-gradient-to-r","from-red-500","via-yellow-400","to-blue-500");
    const cls = genderColor(g); if(cls) genderEl.classList.add(cls);
    genderEl.classList.add("font-semibold"); genderEl.style.fontSize="1.5rem";
    try{ const mq=window.matchMedia("(min-width: 640px)"); const f=()=>genderEl.style.setProperty("font-size", mq.matches?"1.75rem":"1.5rem"); mq.addEventListener?.("change",f); f(); }catch{}
  }

  if(nameEl)  nameEl.textContent = meta.displayName || "";
  if(vipEl)   vipEl.textContent  = typeof meta.vip==="boolean" ? (meta.vip?"👑":"🚫👑") : "";
  if(likesEl) likesEl.textContent= meta?.hideLikes ? "" : typeof meta?.likes==="number" ? `❤️ ${meta.likes}` : "";
  if(avatarEl){ const url=meta?.avatarUrl||meta?.avatar||""; if(url){ avatarEl.src=url; avatarEl.alt=""; } }
}

function apply(meta: PeerMeta){
  const pidEvt=meta?.pairId, pidNow=curPair();
  if(pidEvt && pidNow && pidEvt!==pidNow) return;
  writeCached(meta); render(meta);
}

(function boot(){
  const cached = readCached(); if(cached && Object.keys(cached).length) render(cached);

  const onMeta = (e:any)=>{
    const src = e?.detail || {};
    const flat: PeerMeta = src && typeof src.meta === "object"
      ? { ...(src.meta || {}), pairId: src.pairId ?? src.meta.pairId }
      : src;
    apply(flat);
  };
  const onLikeSync = (e:any)=>{
    const d=e?.detail||{}; const pidEvt=d?.pairId||curPair(), pidNow=curPair();
    if(pidEvt && pidNow && pidEvt!==pidNow) return;
    if(typeof d.count==="number"){ const m={...readCached(), likes:d.count}; writeCached(m); render(m); }
  };
  const onPair=()=>{ const m=readCached(); if(m && Object.keys(m).length) render(m); };
  const onAttached=onPair;
  const onPhase=(e:any)=>{ const ph=e?.detail?.phase; if(ph==="boot"||ph==="idle"||ph==="searching"||ph==="stopped"){ const m=readCached(); render({...m, displayName:"", country:"", city:"", gender:"u"}); } };

  window.addEventListener("ditona:peer-meta", onMeta as any, {passive:true} as any);
  window.addEventListener("like:sync", onLikeSync as any, {passive:true} as any);
  window.addEventListener("rtc:pair", onPair as any, {passive:true} as any);
  window.addEventListener("lk:attached", onAttached as any, {passive:true} as any);
  window.addEventListener("rtc:phase", onPhase as any, {passive:true} as any);

  (globalThis as any).__ditonaPeerMetaCleanup = () => {
    window.removeEventListener("ditona:peer-meta", onMeta as any);
    window.removeEventListener("like:sync", onLikeSync as any);
    window.removeEventListener("rtc:pair", onPair as any);
    window.removeEventListener("lk:attached", onAttached as any);
    window.removeEventListener("rtc:phase", onPhase as any);
  };
})();
