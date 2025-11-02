// src/app/chat/components/FilterBar.tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useFilters, type GenderOpt } from "@/state/filters";
import type { GenderKey } from "./GenderModal";
import CountryPicker from "./CountryPicker";
import countriesRaw from "world-countries";

// -------- Gender key ↔ norm --------
const keyToNorm = (k: GenderKey): "m" | "f" | "c" | "l" | "u" =>
  k === "male" ? "m" :
  k === "female" ? "f" :
  k === "couples" ? "c" :
  k === "lgbt" ? "l" : "u";

const normToKey = (n: "m" | "f" | "c" | "l" | "u"): GenderKey =>
  n === "m" ? "male" :
  n === "f" ? "female" :
  n === "c" ? "couples" :
  n === "l" ? "lgbt" : "any";

// Gender modal (kept)
const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });

export default function FilterBar() {
  const filters = useFilters();

  // current gender from store (supports legacy `gender`)
  const legacyOpt: GenderOpt = filters.gender ?? "all";
  const currentKeysFromLegacy: GenderKey[] =
    legacyOpt === "all"
      ? []
      : [legacyOpt === "male" ? "male" : legacyOpt === "female" ? "female" : legacyOpt === "couple" ? "couples" : "lgbt"];

  const currentGenderKeys: GenderKey[] =
    Array.isArray(filters.genderKeys) && filters.genderKeys.length > 0
      ? (filters.genderKeys as ("m" | "f" | "c" | "l")[]).map(normToKey).filter(k => k !== "any")
      : currentKeysFromLegacy;

  const currentCountries: string[] = Array.isArray(filters.countries) ? filters.countries : [];

  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>(currentGenderKeys);

  // code -> English name
  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countriesRaw) m.set(String(c.cca2).toUpperCase(), String(c.name?.common || ""));
    return m;
  }, []);

  // apply gender (max 2)
  function applyGender(keys: GenderKey[]) {
    const clean = (Array.isArray(keys) ? keys : []).filter(k => k !== "any").slice(0, 2);
    setSelectedGenders(clean);
    const norms = clean.map(keyToNorm).filter(n => n !== "u");
    filters.setGenderKeys(norms);
  }

  // button labels
  const genderLabel = (() => {
    if (selectedGenders.length === 0) return "Everyone";
    if (selectedGenders.length === 1) {
      const k = selectedGenders[0];
      return k === "female" ? "♀ Female"
           : k === "male" ? "♂ Male"
           : k === "couples" ? "⚤ Couples"
           : "🏳️‍🌈 LGBT";
    }
    return "2 selected";
  })();

  const countryLabel = (() => {
    const n = currentCountries.length;
    if (n === 0) return "All";
    if (n === 1) return codeToName.get(currentCountries[0].toUpperCase()) || currentCountries[0].toUpperCase();
    return `${n} countries`;
  })();

  return (
    <div
      className="absolute top-2 right-2 z-[999] pointer-events-auto flex items-center gap-2"
      data-ui="filter-bar"
    >
      {/* Gender */}
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() => { setSelectedGenders(currentGenderKeys); setOpenGender(true); }}
        title="Gender filters"
        className="h-9 px-3 rounded-xl bg-black/30 hover:bg-black/40 text-white text-xs font-medium backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 min-w-[96px] flex items-center gap-1"
      >
        <span aria-hidden>⚧</span>
        <span className="truncate">{genderLabel}</span>
      </button>

      {/* Countries */}
      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        onClick={() => setOpenCountry(true)}
        title="Country filters"
        className="h-9 px-3 rounded-xl bg-black/30 hover:bg-black/40 text-white text-xs font-medium backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 min-w-[96px] flex items-center gap-1"
      >
        <span aria-hidden>🌍</span>
        <span className="truncate">{countryLabel}</span>
      </button>

      {/* Done → apply immediately */}
      <button
        type="button"
        onClick={() => { try { window.dispatchEvent(new CustomEvent("ui:filters:apply")); } catch {} }}
        title="Apply filters"
        className="h-9 px-3 rounded-xl bg-green-600/40 hover:bg-green-600/60 text-white text-xs font-semibold backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        Done
      </button>

      {openGender && (
        <GenderModal
          open
          onClose={() => setOpenGender(false)}
          selected={selectedGenders}
          onChange={(value) => applyGender(Array.isArray(value) ? (value as GenderKey[]) : [])}
        />
      )}

      {openCountry && <CountryPicker onClose={() => setOpenCountry(false)} />}
    </div>
  );
}
