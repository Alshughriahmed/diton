"use client";
import { create } from "zustand";

export type GenderOpt="all"|"male"|"female"|"couple"|"lgbt";

export type FiltersState = {
  gender: GenderOpt;     // matches GenderOpt from utils/filters.ts
  countries: string[];   // ISO-3166 codes (empty = global)
  isVip: boolean;
  setVip: (v:boolean)=>void;
  setGender: (g:GenderOpt)=>void;
  setCountries: (codes:string[])=>void;
  reset: ()=>void;
};

export const useFilters = create<FiltersState>((set)=>({
  gender: "all",
  countries: [],
  isVip: false,
  setVip: (v)=>set({ isVip: !!v }),
  setGender: (g)=>set((s)=> {
    // Free users limited to "all", VIP can choose any gender
    const FREE_FOR_ALL = process.env.NODE_ENV !== 'production' || process.env.FREE_FOR_ALL === '1';
    if (!s.isVip && !FREE_FOR_ALL && g !== "all") return s;
    return { gender: g };
  }),
  setCountries: (codes)=>set((s)=>{
    const FREE_FOR_ALL = process.env.NODE_ENV !== 'production' || process.env.FREE_FOR_ALL === '1';
    // Free users limited to empty array (global) or their own country
    if (!s.isVip && !FREE_FOR_ALL) return { countries: [] };
    // VIP users can select up to 15 countries
    const next = !codes?.length ? [] : codes.slice(0,15);
    return { countries: next };
  }),
  reset: ()=>set({ gender:"all", countries:[] }),
}));
