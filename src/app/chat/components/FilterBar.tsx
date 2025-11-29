// src/app/chat/components/FilterBar.tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useFilters, type GenderOpt } from "@/state/filters";
import type { GenderKey } from "./GenderModal";
import CountryPicker from "./CountryPicker";
import countriesRaw from "world-countries";

const keyToNorm = (k: GenderKey): "m"|"f"|"c"|"l"|"u" =>
  k==="male"?"m":k==="female"?"f":k==="couples"?"c":k==="lgbt"?"l":"u";
const normToKey = (n:"m"|"f"|"c"|"l"|"u"): GenderKey =>
  n==="m"?"male":n==="f"?"female":n==="c"?"couples":n==="l"?"lgbt":"any";

const GenderModal = dynamic(() => import("./GenderModal"), { ssr:false });

export default function FilterBar() {
  const filters = useFilters();

  const legacy: GenderOpt = filters.gender ?? "all";
  const legacyKeys: GenderKey[] = legacy === "all" ? [] : [legacy==="male"?"male":legacy==="female"?"female":legacy==="couple"?"couples":"lgbt"];
  const currentKeys: GenderKey[] =
    Array.isArray(filters.genderKeys) && filters.genderKeys.length>0
      ? (filters.genderKeys as any[]).map(normToKey).filter(k => k!=="any")
      : legacyKeys;

  const currentCountries: string[] = Array.isArray(filters.countries)?filters.countries:[];

  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>(currentKeys);

  const codeToName = useMemo(() => {
    const m = new Map<string,string>();
    for (const c of countriesRaw) m.set(String(c.cca2).toUpperCase(), String(c.name?.common||""));
    return m;
  },[]);

  function fireUpdatedSoon() {
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent("filters:updated")); } catch {} }, 0);
  }

  function applyGender(keys: GenderKey[]) {
    const clean = (Array.isArray(keys)?keys:[]).filter(k=>k!=="any").slice(0,2);
    setSelectedGenders(clean);
    const norms = clean.map(keyToNorm).filter(n=>n!=="u");
    filters.setGenderKeys(norms);
    fireUpdatedSoon();
  }

  const genderLabel = (() => {
    if (selectedGenders.length===0) return "Everyone";
    if (selectedGenders.length===1) {
      const k = selectedGenders[0];
      return k==="female"?"♀ Female":k==="male"?"♂ Male":k==="couples"?"⚤ Couples":"🏳️‍🌈 LGBT";
    }
    return "2 selected";
  })();

  const countryLabel = (() => {
    const n = currentCountries.length;
    if (n===0) return "All";
    if (n===1) return codeToName.get(currentCountries[0].toUpperCase()) || currentCountries[0].toUpperCase();
    return `${n} countries`;
  })();

  return (
    <div className="absolute top-2 right-2 z-[999] pointer-events-auto flex items-center gap-2" data-ui="filter-bar">
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() => { setSelectedGenders(currentKeys); setOpenGender(true); }}
        title="Gender filters"
        className="h-9 px-3 rounded-xl bg-black/30 hover:bg-black/40 text-white text-xs font-medium backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 min-w-[96px] flex items-center gap-1"
      >
        <span aria-hidden>⚧</span><span className="truncate">{genderLabel}</span>
      </button>

      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        onClick={() => setOpenCountry(true)}
        title="Country filters"
        className="h-9 px-3 rounded-xl bg-black/30 hover:bg-black/40 text-white text-xs font-medium backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 min-w-[96px] flex items-center gap-1"
      >
        <span aria-hidden>🌍</span><span className="truncate">{countryLabel}</span>
      </button>

      {openGender && (
        <GenderModal
          open
          onClose={() => setOpenGender(false)}
          selected={selectedGenders}
          onChange={(value) => applyGender(Array.isArray(value) ? (value as GenderKey[]) : [])}
        />
      )}

      {openCountry && (
        <CountryPicker
          onClose={(codes?: string[]) => {
            setOpenCountry(false);
            if (Array.isArray(codes)) { filters.setCountries(codes); fireUpdatedSoon(); }
          }}
        />
      )}
    </div>
  );
}
