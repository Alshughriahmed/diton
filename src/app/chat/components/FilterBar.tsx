"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useFFA } from "@/lib/useFFA";
import { useFilters, type GenderOpt } from "@/state/filters";
import type { GenderKey } from "./GenderModal";
import { getAllRegions } from "@/lib/regions";

// Modals
const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

// map UI key ↔ norm
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

export default function FilterBar() {
  const ffa = useFFA();
  const filters = useFilters();

  // derive current selection
  const legacyOpt: GenderOpt = filters.gender ?? "all";
  const currentKeysFromLegacy: GenderKey[] =
    legacyOpt === "all" ? [] :
    [legacyOpt === "male" ? "male" :
     legacyOpt === "female" ? "female" :
     legacyOpt === "couple" ? "couples" : "lgbt"];

  const currentKeys: GenderKey[] =
    Array.isArray(filters.genderKeys) && filters.genderKeys.length > 0
      ? filters.genderKeys.map((n) => normToKey(n as any)).filter((k) => k !== "any")
      : currentKeysFromLegacy;

  const currentCountries: string[] = Array.isArray(filters.countries) ? filters.countries : [];

  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>(currentKeys);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(currentCountries);

  // countries map for labeling
  const regions = useMemo(() => getAllRegions(), []);
  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of regions) m.set(r.code.toUpperCase(), r.name);
    return m;
  }, [regions]);

  function applyGender(keys: GenderKey[]) {
    // allow up to 2; auto-trim
    const clean = Array.isArray(keys) ? keys.filter(k => k !== "any").slice(0, 2) : [];
    setSelectedGenders(clean);
    const norms = clean.map(keyToNorm).filter((n) => n !== "u");
    filters.setGenderKeys(norms);
  }

  function applyCountries(codes: string[]) {
    const next = Array.isArray(codes) ? codes : [];
    filters.setCountries(next);
    setSelectedCountries(next);
  }

  // button labels
  const genderLabel = (() => {
    if (selectedGenders.length === 0) return "Everyone";
    if (selectedGenders.length === 1) {
      const k = selectedGenders[0];
      return k === "female" ? "♀ Female"
           : k === "male" ? "♂ Male"
           : k === "couples" ? "👫 Couples"
           : "🏳️‍🌈 LGBT";
    }
    return "2 selected";
  })();

  const countryLabel = (() => {
    const n = selectedCountries.length;
    if (n === 0) return "All";
    if (n === 1) return codeToName.get(selectedCountries[0].toUpperCase()) || selectedCountries[0].toUpperCase();
    return `${n} countries`;
  })();

  return (
    <div className="absolute top-2 right-2 z-[999] pointer-events-auto flex items-center gap-2" data-ui="filter-bar">
      {/* Gender */}
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() => { setSelectedGenders(currentKeys); setOpenGender(true); }}
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
        onClick={() => { setSelectedCountries(currentCountries); setOpenCountry(true); }}
        title="Country filters"
        className="h-9 px-3 rounded-xl bg-black/30 hover:bg-black/40 text-white text-xs font-medium backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 min-w-[96px] flex items-center gap-1"
      >
        <span aria-hidden>🌍</span>
        <span className="truncate">{countryLabel}</span>
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
        <CountryModal
          open
          onClose={() => setOpenCountry(false)}
          selected={selectedCountries}
          onChange={(value) => applyCountries(Array.isArray(value) ? value : [])}
        />
      )}
    </div>
  );
}
