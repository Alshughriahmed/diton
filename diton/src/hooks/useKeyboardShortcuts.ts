"use client"; import { useEffect } from "react"; import { emit } from "@/utils/events";
export function useKeyboardShortcuts(){ useEffect(()=>{ const h=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();
  if(k==="arrowright"||k==="n")emit("ui:next"); else if(k==="arrowleft"||k==="p")emit("ui:prev");
  else if(k==="m")emit("ui:toggleMic"); else if(k==="c")emit("ui:toggleCam"); else if(k==="s")emit("ui:openSettings");};
  window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h); },[]); }