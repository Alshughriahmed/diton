"use client";
import { create } from "zustand";

export type FiltersState = {
  gender: string;        // we render exactly what's in src/data/genders.ts (unified taxonomy you approved)
  countries: string[];   // ISO-3166 codes (ALL = global)
  isVip: boolean;
  setVip: (v:boolean)=>void;
  setGender: (g:string)=>void;
  setCountries: (codes:string[])=>void;
  reset: ()=>void;
};

export const useFilters = create<FiltersState>((set)=>({
  gender: "All",
  countries: ["ALL"],
  isVip: false,
  setVip: (v)=>set({ isVip: !!v }),
  setGender: (g)=>set((s)=> s.isVip ? { gender:g } : { gender:"All" }),
  setCountries: (codes)=>set((s)=>{
    if(!s.isVip) return { countries:["ALL"] };
    const next = !codes?.length ? ["ALL"] : codes.slice(0,15);
    return { countries: next };
  }),
  reset: ()=>set({ gender:"All", countries:["ALL"] }),
}));
