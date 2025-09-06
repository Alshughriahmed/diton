"use client"; import { emit } from "@/utils/events";
let last=0; const CD=700;
export function useNextPrev(){ function can(){const n=Date.now(); if(n-last<CD) return false; last=n; return true;}
  return { next(){ if(can()) emit("ui:next"); }, prev(){ if(can()) emit("ui:prev"); } };
}