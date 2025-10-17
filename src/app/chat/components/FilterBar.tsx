"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useFFA } from "@/lib/useFFA";
import { useVip } from "@/hooks/useVip";
import { useFilters, type GenderOpt } from "@/state/filters";
import type { GenderKey } from "./GenderModal";

const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

const optToKey = (g: GenderOpt): GenderKey | null =>
  g === "male" ? "male"
  : g === "female" ? "female"
  : g === "couple" ? "couples"
  : g === "lgbt" ? "lgbt"
  : null;

const keyToOpt = (k: GenderKey): GenderOpt =>
  k === "male" ? "male"
  : k === "female" ? "female"
  : k === "couples" ? "couple"
  : "lgbt";

export default function FilterBar() {
  const ffa = useFFA();
  const { isVip } = useVip();
  const filters = useFilters();

  const currentSelections: GenderOpt[] = filters.genderSelections?.length
    ? filters.genderSelections
    : (filters.gender === "all" ? [] : [filters.gender]);

  const currentCountries: string[] = Array.isArray(filters.countries) ? filters.countries : [];

  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>(
    currentSelections.map(g => optToKey(g)).filter(Boolean) as GenderKey[]
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(currentCountries);

  function applyGender(keys: GenderKey[]) {
    let v = Array.isArray(keys) ? keys.slice(0, 2) : [];
    if (!isVip && !ffa && v.length > 1) v = [v[0]];

    if (v.length === 0) {
      filters.setGenderSelections([]);
      filters.setGender("all");
      setSelectedGenders([]);
      return;
    }

    const opts = v.map(keyToOpt);
    filters.setGenderSelections(opts);
    setSelectedGenders(v);
  }

  function applyCountries(codes: string[]) {
    const next = Array.isArray(codes) ? codes : [];
    filters.setCountries(next);
    setSelectedCountries(next);
  }

  return (
    <div className="absolute top-2 right-2 z-[999] pointer-events-auto flex items-center gap-2" data-ui="filter-bar">
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() => {
          const initial = (filters.genderSelections?.length
            ? filters.genderSelections
            : (filters.gender === "all" ? [] : [filters.gender])
          ).map(g => optToKey(g)).filter(Boolean) as GenderKey[];
          setSelectedGenders(initial);
          setOpenGender(true);
        }}
        title="Gender filters"
        className="h-9 w-9 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <span aria-hidden className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400">⚧</span>
      </button>

      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        onClick={() => { setSelectedCountries(currentCountries); setOpenCountry(true); }}
        title="Country filters"
        className="h-9 w-9 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <span aria-hidden>🌍</span>
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
