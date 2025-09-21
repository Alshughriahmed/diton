"use client";
import { useSyncExternalStore } from "react";

function snap(): boolean {
  try { 
    const v = (globalThis as any)?.window?.__DITONA_FFA; 
    return v === 1 || v === "1" || v === true || v === "true"; 
  } catch { 
    return false; 
  }
}

function sub(cb: () => void) { 
  const h = () => cb(); 
  try {
    window.addEventListener("ffa:ready", h as any, { passive: true });
    window.addEventListener("ditona:ffa", h as any, { passive: true });
  } catch {}
  
  return () => { 
    try {
      window.removeEventListener("ffa:ready", h as any);
      window.removeEventListener("ditona:ffa", h as any);
    } catch {} 
  }; 
}

export function useFFA(): boolean { 
  return typeof window === "undefined" ? false : useSyncExternalStore(sub, snap, () => false); 
}

export function isFFA(): boolean { 
  return snap(); 
}
