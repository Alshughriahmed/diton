"use client";
import { useEffect } from "react";
import GenderSelect from "./GenderSelect";
import CountrySelect from "./CountrySelect";
import { useFilters } from "@/state/filters";

export default function FilterBar(){
  const { setVip } = useFilters();
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const r = await fetch("/api/user/vip-status",{cache:"no-store"});
        const j = await r.json().catch(()=>({isVip:false}));
        if(alive) setVip(!!j?.isVip);
      }catch{ if(alive) setVip(false); }
    })();
    return ()=>{ alive=false; };
  },[setVip]);

  return (
    <div className="absolute top-3 right-3 z-[40] flex items-center gap-3">
      <GenderSelect/>
      <CountrySelect/>
    </div>
  );
}
