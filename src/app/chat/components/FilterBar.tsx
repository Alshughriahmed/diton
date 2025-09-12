"use client";
import { useEffect, useMemo, useState } from "react";
import CountryModal from "./CountryModal";
import GenderModal, { GenderKey } from "./GenderModal";

const LS_COUNTRIES = "ditona:filters:countries";
const LS_GENDERS   = "ditona:filters:genders"; // بدون "any"

function useStored<T>(key: string, def: T) {
  const [val, setVal] = useState<T>(def);
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(key);
      if (raw) setVal(JSON.parse(raw));
    }catch{} 
  }, [key]);
  useEffect(()=>{ 
    try{
      localStorage.setItem(key, JSON.stringify(val));
    }catch{} 
  }, [key, val]);
  return [val, setVal] as const;
}

export default function FilterBar() {
  const [openCountries, setOpenCountries] = useState(false);
  const [openGender, setOpenGender] = useState(false);
  const [countries, setCountries] = useStored<string[]>(LS_COUNTRIES, []);
  const [genders, setGenders]     = useStored<GenderKey[]>(LS_GENDERS, []);
  const [isVip, setIsVip] = useState(false);

  // Fetch VIP status on mount
  useEffect(()=>{
    fetch("/api/user/vip-status").then(r=>r.json()).then(j=>{ 
      try{ setIsVip(!!(j?.isVip||j?.vip)); }catch{} 
    }).catch(()=>{});
  }, []);

  // Reset non-VIP genders to Everyone only
  useEffect(()=>{ 
    if(!isVip && genders.length > 0){ 
      setGenders([]); 
    } 
  }, [isVip]);

  // النص المعروض
  const countriesBadge = countries.length>0 ? countries.length : 0;
  const genderLabel = useMemo(()=>{
    if (genders.length===0) return "Everyone";
    const map: Record<GenderKey,string> = {any:"Everyone", female:"Female", male:"Male", couples:"Couples", lgbt:"LGBT"};
    return genders.map(g=>map[g]).join(" + ");
  }, [genders]);

  // بثّ حدث داخلي ليستفيد منه أي كود قائم (لا نكسر شيء)
  useEffect(()=>{
    const detail = { countries, genders };
    window.dispatchEvent(new CustomEvent("ditona:filters", { detail }));
  }, [countries, genders]);

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-40 flex items-center gap-2">
      {/* Countries */}
      <button
        onClick={()=>setOpenCountries(true)}
        className="relative rounded-2xl bg-white/10 backdrop-blur px-3 md:px-4 py-2 text-white shadow ring-1 ring-white/20 hover:bg-white/20"
        title="Country Filter"
      >
        <span className="mr-1">🌍</span>
        <span className="hidden md:inline">Countries</span>
        {countriesBadge>0 && (
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs w-5 h-5">{countriesBadge}</span>
        )}
      </button>

      {/* Gender */}
      <button
        onClick={()=>setOpenGender(true)}
        className="rounded-2xl bg-white/10 backdrop-blur px-3 md:px-4 py-2 text-white shadow ring-1 ring-white/20 hover:bg-white/20"
        title="Gender Filter"
      >
        <span className="mr-1">⚧️</span>
        <span className="hidden md:inline">{genderLabel}</span>
      </button>

      <CountryModal
        open={openCountries}
        onClose={()=>setOpenCountries(false)}
        selected={countries}
        onChange={setCountries}
      />
      <GenderModal
        open={openGender}
        onClose={()=>setOpenGender(false)}
        selected={genders}
        onChange={setGenders}
      />
    </div>
  );
}
