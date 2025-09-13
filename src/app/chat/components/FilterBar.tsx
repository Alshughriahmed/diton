"use client";
import { useEffect, useMemo, useState } from "react";
import { emit } from "@/utils/events";
import { COUNTRIES, ALL_COUNTRIES_OPTION } from "@/data/countries";

type GenderKey = "everyone"|"female"|"male"|"couples"|"lgbt";

function flagOf(cc:string){
  if(!cc) return "🌍";
  return cc.replace(/./g,c=>String.fromCodePoint(0x1f1e6+(c.toUpperCase().charCodeAt(0)-65)));
}

export default function FilterBar(){
  const [openLoc,setOpenLoc]=useState(false);
  const [openGen,setOpenGen]=useState(false);

  const [userCC,setUserCC]=useState<string|undefined>(undefined);
  const [countries,setCountries]=useState<string[]>(()=>JSON.parse(localStorage.getItem("ditona:filters:countries")||"[]"));
  const [genders,setGenders]=useState<GenderKey[]>(()=>JSON.parse(localStorage.getItem("ditona:filters:genders")||'["everyone"]'));

  useEffect(()=>{ // محاولة قراءة بلد المستخدم إن وُجد
    try{
      const g = JSON.parse(localStorage.getItem("ditona:geo")||"{}");
      if(g?.countryCode) setUserCC(g.countryCode);
    }catch{}
  },[]);
  useEffect(()=>{ localStorage.setItem("ditona:filters:countries",JSON.stringify(countries)); },[countries]);
  useEffect(()=>{ localStorage.setItem("ditona:filters:genders",JSON.stringify(genders)); },[genders]);

  const regions = useMemo(() => {
    const base = COUNTRIES || [];
    const rest = base.filter(r => r.code !== userCC);
    const all = [
      ...(userCC ? base.filter(r=>r.code===userCC) : []),
      ALL_COUNTRIES_OPTION,
      ...rest.sort((a,b)=>a.name.localeCompare(b.name))
    ];
    return all;
  },[userCC]);

  const [q,setQ]=useState("");
  const view = regions.filter(r=>r.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()));

  const badgeCnt = countries.length>0 && !countries.includes("ALL") ? countries.length : 0;

  const toggleCountry=(cc:string)=>{
    if(cc==="ALL"){ setCountries(["ALL"]); return; }
    setCountries(prev=>{
      const base = (prev.includes("ALL") ? [] : prev).slice();
      const i = base.indexOf(cc);
      if(i>=0){ base.splice(i,1); return base; }
      if(base.length>=15) return base; // VIP cap محفوظ لاحقًا
      base.push(cc); return base;
    });
  };

  const toggleGender=(g:GenderKey)=>{
    if(g==="everyone"){ setGenders(["everyone"]); return; }
    setGenders(prev=>{
      let base=prev.includes("everyone")?[]:[...prev];
      const i=base.indexOf(g);
      if(i>=0){ base.splice(i,1); if(base.length===0) base=["everyone"]; return base; }
      if(base.length>=2) return base;
      base.push(g); return base;
    });
  };

  return (
    <div className="absolute top-1 right-1 z-[80] flex gap-2 select-none">
      {/* Location button */}
      <div className="relative">
        <button data-ui="country-button"
          onClick={()=>{setOpenLoc(v=>!v); setOpenGen(false);}}
          className="h-9 px-3 rounded-full bg-black/40 text-white border border-white/15 backdrop-blur flex items-center gap-2">
          <span>🌍</span><span>Location</span>
          {badgeCnt>0 && <span className="ml-1 text-xs rounded-full bg-white/20 px-2 py-0.5">{badgeCnt}</span>}
        </button>
        {openLoc && (
          <div role="dialog" aria-label="Location"
               className="absolute mt-2 right-0 w-[min(92vw,640px)] max-h-[60vh] overflow-auto rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur p-3 shadow-xl z-[90]"
               onKeyDown={(e)=>{ if(e.key==="Escape") setOpenLoc(false); }}>
            <div className="flex items-center gap-2 mb-3">
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search country"
                     className="w-full h-10 px-3 rounded-xl bg-zinc-800/70 text-white outline-none border border-white/10"/>
              <button onClick={()=>setOpenLoc(false)}
                      className="h-10 px-4 rounded-xl bg-white/10 text-white">Done</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {view.map(r=>{
                const active = countries.includes("ALL") ? r.code==="ALL" : countries.includes(r.code);
                return (
                  <button key={r.code}
                          onClick={()=>toggleCountry(r.code)}
                          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left border ${active?'bg-indigo-600/20 border-indigo-400/40':'bg-white/5 border-white/10'} hover:bg-white/10`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{r.code==="ALL"?"🌐":flagOf(r.code)}</span>
                      <span className="text-white">{r.name}</span>
                    </div>
                    <span className="text-xs text-white/60">{r.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Gender button */}
      <div className="relative">
        <button data-ui="gender-button"
          onClick={()=>{setOpenGen(v=>!v); setOpenLoc(false);}}
          className="h-9 px-3 rounded-full bg-black/40 text-white border border-white/15 backdrop-blur flex items-center gap-2">
          <span>⚧</span><span>Gender</span>
        </button>
        {openGen && (
          <div role="dialog" aria-label="Gender"
               className="absolute mt-2 right-0 w-[min(92vw,360px)] max-h-[60vh] overflow-auto rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur p-3 shadow-xl z-[90]"
               onKeyDown={(e)=>{ if(e.key==="Escape") setOpenGen(false); }}>
            {([
              {k:"everyone",label:"Everyone",icon:"👥"},
              {k:"female",label:"Female",icon:"♀️"},
              {k:"male",label:"Male",icon:"♂️"},
              {k:"couples",label:"Couples",icon:"👫"},
              {k:"lgbt",label:"LGBT",icon:"🏳️‍🌈"},
            ] as Array<{k:GenderKey;label:string;icon:string}>).map(it=>{
              const active = genders.includes(it.k as GenderKey);
              return (
                <button key={it.k}
                        onClick={()=>toggleGender(it.k as GenderKey)}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-3 mb-2 border ${active?'bg-blue-600/25 border-blue-400/40':'bg-white/5 border-white/10'} hover:bg-white/10`}>
                  <span className="flex items-center gap-3">
                    <span className="text-lg">{it.icon}</span>
                    <span className="text-white">{it.label}</span>
                  </span>
                  {active && <span className="text-xs text-white/70">Selected</span>}
                </button>
              );
            })}
            <div className="text-xs text-white/50 mt-1">VIP users can select up to two genders.</div>
            <div className="mt-3 flex justify-end">
              <button onClick={()=>setOpenGen(false)} className="h-10 px-4 rounded-xl bg-white/10 text-white">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}