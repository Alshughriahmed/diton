"use client";
export type GenderOpt="all"|"male"|"female"|"couple"|"lgbt";
export type Filters={gender:GenderOpt; countries:string[]};
const KEY="ditona.filters";
export function getFilters():Filters{ if(typeof window==="undefined") return {gender:"all",countries:[]};
  try{const v=JSON.parse(localStorage.getItem(KEY)||"{}"); return {gender:v.gender||"all", countries:Array.isArray(v.countries)?v.countries:[]};}
  catch{ return {gender:"all",countries:[]}; } }
export function setFilters(f:Filters){ if(typeof window!=="undefined") localStorage.setItem(KEY,JSON.stringify(f)); }