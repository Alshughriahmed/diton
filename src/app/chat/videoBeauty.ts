"use client";
export function mountBeauty(el: HTMLElement){
  let level=0;
  const apply=()=>{
    const v = ["","contrast(1.05) brightness(1.05) saturate(1.05)",
      "contrast(1.1) brightness(1.08) saturate(1.1) blur(0.2px)",
      "contrast(1.15) brightness(1.1) saturate(1.15) blur(0.35px)"].at(level) as string;
    el.style.filter = v||"";
  };
  apply();
  const onEvt = (e:any)=>{ level = Math.max(0, Math.min(3, e?.detail?.level ?? 1)); apply(); };
  window.addEventListener("ditona:beauty", onEvt as any);
  return ()=> window.removeEventListener("ditona:beauty", onEvt as any);
}