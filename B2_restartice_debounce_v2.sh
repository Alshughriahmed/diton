#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/B2_fix_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# 1) الدوال إن غابت
grep -q 'function scheduleRestartIce' "$F" || cat >> "$F" <<'TS'
/** Debounced ICE restart (1100ms) */
let __iceRestartTimer:any=null;
async function __doRestartIce(){
  if(!state?.pc || state?.ac?.signal?.aborted) return;
  try{
    if(typeof state.pc.restartIce==='function'){ state.pc.restartIce(); }
    else{
      const offer=await state.pc.createOffer({iceRestart:true});
      await state.pc.setLocalDescription(offer);
    }
  }catch(e){ try{ if((e?.name||"")!=="AbortError") console.warn("restartIce fail",e);}catch{} }
}
function scheduleRestartIce(delay:number=1100){
  try{ if(__iceRestartTimer) return; __iceRestartTimer=setTimeout(()=>{__iceRestartTimer=null; __doRestartIce();},delay);}catch{}
}
TS

# 2) ربط handler: إن وُجد onconnectionstatechange ضِف نداءنا؛ وإلا ضِف addEventListener بعد إنشاء RTCPeerConnection
if grep -q 'onconnectionstatechange' "$F"; then
  grep -q 'scheduleRestartIce' "$F" || true
  perl -0777 -pe '
    s/(onconnectionstatechange\s*=\s*\(\)\s*=>\s*\{\s*)/$1 try{const st=(state.pc as any).connectionState; if(st==="disconnected"||st==="failed"){ scheduleRestartIce(1100); }}catch{} /s
  ' -i "$F"
else
  # بعد أول إنشاء RTCPeerConnection
  awk '
    BEGIN{ins=0}
    /state\.pc\s*=\s*new\s+RTCPeerConnection\s*\(/ && ins==0 {
      print; print "    try{ state.pc?.addEventListener(\"connectionstatechange\",()=>{ try{ const st=(state.pc as any).connectionState; if(st===\"disconnected\"||st===\"failed\"){ scheduleRestartIce(1100); } }catch{} }); }catch{}";
      ins=1; next
    } { print }
  ' "$F" > "$F.tmp" && mv "$F.tmp" "$F"
fi

echo "-- Acceptance --"
echo "ICE_RESTART_DEBOUNCED=$([ "$(grep -c 'scheduleRestartIce' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "HOOKED_CONNSTATE=$([ "$(grep -Ec 'onconnectionstatechange|connectionstatechange\",' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
