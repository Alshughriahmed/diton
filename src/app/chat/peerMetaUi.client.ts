declare global { interface Window { __updatePeerBadges?: (meta:any)=>void } }
if (typeof window !== "undefined") {
  window.__updatePeerBadges = window.__updatePeerBadges || (()=>{ /* no-op stub */ });
}
export {};
