"use client";
import { useEffect, useMemo, useState } from "react";
import { useFilters } from "@/state/filters";
import { COUNTRIES, ALL_COUNTRIES_OPTION } from "@/data/countries";
import { emit } from "@/utils/events";

export default function CountrySelect(){
  const { countries, setCountries, isVip } = useFilters();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Fetch user's country on mount
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then(d => setUserCountry(d?.country || null))
      .catch(() => setUserCountry(null));
  }, []);

  const list = useMemo(()=>{
    // Build list: All Countries, user's country (if available), then rest alphabetically
    const userCountryObj = userCountry ? COUNTRIES.find(c => c.code === userCountry) : null;
    const restCountries = COUNTRIES.filter(c => !userCountry || c.code !== userCountry);
    
    let arr = [ALL_COUNTRIES_OPTION];
    if (userCountryObj) arr.push(userCountryObj);
    arr.push(...restCountries);
    
    if(!q) return arr;
    const qq = q.toLowerCase();
    return arr.filter(c=> c.name.toLowerCase().includes(qq) || c.code.toLowerCase().includes(qq));
  },[q, userCountry]);

  const toggle = (code:string)=>{
    // Allow ALL and user's own country for non-VIP users
    if(!isVip && code !== "ALL" && code !== userCountry) {
      emit('ui:upsell', { feature: 'country-filters' });
      return;
    }
    
    if(code==="ALL") return setCountries(["ALL"]);
    
    const base = countries.includes("ALL") ? [] : countries.slice();
    const i = base.indexOf(code);
    if(i>=0) base.splice(i,1); else base.push(code);
    setCountries(base.slice(0,15));
  };

  useEffect(()=>{ if(!isVip) setCountries(["ALL"]); }, [isVip, setCountries]);

  return (
    <div className="relative">
      <button onClick={()=>setOpen(v=>!v)}
        className="px-2 py-1 rounded-md bg-neutral-800 text-white text-sm border border-neutral-700"
        aria-haspopup="listbox" aria-expanded={open}>
        Countries {countries.includes("ALL") ? "(All)" : `(${countries.length})`}
      </button>
      {!isVip && <span className="ml-2 text-[10px] opacity-60">VIP</span>}
      {open && (
        <div className="absolute right-0 mt-2 z-[40] w-[460px] max-h-[320px] overflow-auto p-3 rounded-xl bg-neutral-900 border border-neutral-700 shadow-lg">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search countries..."
                 className="w-full mb-2 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"/>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {list.map(c=>(
              <button key={c.code} onClick={()=>toggle(c.code)}
                className={`text-left px-2 py-1 rounded text-sm hover:bg-neutral-800 ${countries.includes(c.code)?"bg-neutral-800":""} ${
                  !isVip && c.code !== "ALL" && c.code !== userCountry ? 'opacity-60' : ''
                }`}
                role="option" aria-selected={countries.includes(c.code)}>
                {c.name} <span className="opacity-50 text-[10px]">({c.code})</span>
                {!isVip && c.code !== "ALL" && c.code !== userCountry && (
                  <span className="ml-1 text-xs">🔒</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
