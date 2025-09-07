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
  setGender: (g)=>set((s)=> s.isVip ? { gender:g } : { gender:"all" }),
  setCountries: (codes)=>set((s)=>{
    if(!s.isVip) return { countries:[] };
    const next = !codes?.length ? [] : codes.slice(0,15);
    return { countries: next };
  }),
  reset: ()=>set({ gender:"all", countries:[] }),
}));
