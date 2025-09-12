"use client";
import { useEffect, useMemo, useState } from "react";
import CountryModal from "./CountryModal";
import GenderModal, { GenderKey } from "./GenderModal";
import { isBrowser, lsGet, lsSet } from "@/utils/browser";

const LS_COUNTRIES = "ditona:filters:countries";
const LS_GENDERS   = "ditona:filters:genders";

function useStored<T>(key: string, def: T) {
  const [val, setVal] = useState<T>(def);
  useEffect(()=>{
    if (isBrowser()) {
      const stored = lsGet(key, def);
      if (stored !== null) setVal(stored);
    }
  }, [key]);
  useEffect(()=>{ 
    if (isBrowser()) {
      lsSet(key, val);
    }
  }, [key, val]);
  return [val, setVal] as const;
}

export default function FilterBar() {
  const [openCountries, setOpenCountries] = useState(false);
  const [openGender, setOpenGender] = useState(false);
  const [countries, setCountries] = useStored<string[]>(LS_COUNTRIES, []);
  const [genders, setGenders]     = useStored<GenderKey[]>(LS_GENDERS, []);
  const [isVip, setIsVip] = useState(false);

  // Fetch VIP status and geo on mount
  useEffect(()=>{
    // Fetch VIP status
    fetch("/api/user/vip-status").then(r=>r.json()).then(j=>{ 
      try{ 
        const vip = !!(j?.isVip||j?.vip);
        setIsVip(vip);
        // Cache VIP status for filtersBridge
        if (isBrowser()) {
          lsSet("ditona:vip-status", vip);
        }
      }catch{} 
    }).catch(()=>{});
    
    // Fetch user geo for defensive filtering
    fetch("/api/geo").then(r=>r.json()).then(j=>{
      try{
        const code = (j?.countryCode || j?.country || "").toString().toUpperCase();
        if (code && /^[A-Z]{2}$/.test(code) && isBrowser()) {
          lsSet("ditona:geo:country", code);
        }
      }catch{}
    }).catch(()=>{});
  }, []);

  // Normalize filters when VIP status changes
  useEffect(()=>{ 
    if(!isVip) {
      // Reset genders to Everyone for non-VIP
      if (genders.length > 0) setGenders([]);
      
      // Normalize countries: user country only or All
      const userCode = isBrowser() ? lsGet("ditona:geo:country", null) : null;
      
      if (countries.length > 1 || (countries.length === 1 && userCode && !countries.includes(userCode))) {
        setCountries(userCode ? [userCode] : []);
      }
    }
  }, [isVip]);

  // Badge display logic
  const countriesBadge = countries.length > 0 ? countries.length.toString() : "All";
  const genderBadge = useMemo(()=>{
    if (genders.length === 0) return "All";
    if (genders.length === 1) {
      const map: Record<GenderKey,string> = {any:"All", female:"♀", male:"♂", couples:"👫", lgbt:"🏳️‍🌈"};
      return map[genders[0]] || "All";
    }
    if (genders.length === 2) {
      const map: Record<GenderKey,string> = {any:"All", female:"♀", male:"♂", couples:"👫", lgbt:"🏳️‍🌈"};
      return genders.map(g => map[g]).join("+");
    }
    return "All";
  }, [genders]);

  // Broadcast internal event for any existing code
  useEffect(()=>{
    if (isBrowser()) {
      const detail = { countries, genders };
      window.dispatchEvent(new CustomEvent("ditona:filters", { detail }));
    }
  }, [countries, genders]);

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-2 pointer-events-auto">
      {/* Countries */}
      <button
        data-ui="country-button"
        onClick={()=>setOpenCountries(true)}
        className="relative flex flex-col items-center justify-center rounded-xl bg-white/5 backdrop-blur px-3 py-2 text-white shadow-sm hover:bg-white/10 transition-all"
        title="Country Filter"
      >
        <span className="text-lg">🌍</span>
        <span data-ui="country-count-badge" className="text-xs mt-0.5 font-medium">{countriesBadge}</span>
      </button>

      {/* Gender */}
      <button
        data-ui="gender-button"
        onClick={()=>setOpenGender(true)}
        className="flex flex-col items-center justify-center rounded-xl bg-white/5 backdrop-blur px-3 py-2 text-white shadow-sm hover:bg-white/10 transition-all"
        title="Gender Filter"
      >
        <span className="text-lg">⚧️</span>
        <span data-ui="gender-badge" className="text-xs mt-0.5 font-medium">{genderBadge}</span>
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
