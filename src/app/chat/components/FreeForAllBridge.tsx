"use client";
import { useEffect } from "react";

type EmitFn = (ev: string, payload?: any) => void;

async function loadBus(): Promise<EmitFn> {
  try { 
    const m = await import("@/utils/events"); 
    if ((m as any).emit) return (m as any).emit as EmitFn; 
  } catch {}
  try { 
    const m = await import("@/utils/bus");    
    if ((m as any).busEmit) return (m as any).busEmit as EmitFn; 
  } catch {}
  
  // fallback: echo to window (so listeners there still work)
  return (ev: string, payload?: any) => { 
    try { 
      window.dispatchEvent(new CustomEvent(ev, { detail: payload })); 
    } catch {} 
  };
}

function setFFAFromWindow(){ /* shim: removed; FFA comes from useFFA() */ }

export default function FreeForAllBridge() {
  useEffect(() => { 
    setFFAFromWindow(); 
    
    (async () => {
      const emit = await loadBus();
      const relay = (name: string) => (e: any) => emit(name, e?.detail ?? e);
      const evs = ["rtc:pair", "rtc:phase", "ditona:peer-meta", "ditona:ffa", "ffa:ready"];
      
      evs.forEach(n => window.addEventListener(n, relay(n) as any, { passive: true }));
      
      return () => evs.forEach(n => window.removeEventListener(n, relay(n) as any));
    })(); 
  }, []);
  
  return null;
}