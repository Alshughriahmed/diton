"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useFilters } from "@/state/filters";
import type { GenderOpt } from "@/state/filters";
import type { GenderKey } from "./GenderModal";

const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

export default function FilterBar() {
  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const { gender, countries, setGender, setCountries } = useFilters();

  // Convert between old filter system (string) and new modal system (array)
  const genderToArray = (g: GenderOpt): GenderKey[] => {
    if (g === "all") return [];
    if (g === "couple") return ["couples"];
    return [g as GenderKey];
  };

  const arrayToGender = (vals: GenderKey[]): GenderOpt => {
    if (vals.length === 0) return "all";
    if (vals.includes("couples")) return "couple";
    return vals[0] as GenderOpt;
  };

  return (
    <div className="absolute top-1 right-1 z-[60] flex items-center gap-2 pointer-events-none">
      {/* Gender */}
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() => setOpenGender(true)}
        className="pointer-events-auto h-8 w-8 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white text-sm backdrop-blur transition"
      >
        <span
          aria-hidden
          className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400"
          style={{ lineHeight: 1 }}
        >
          ⚧
        </span>
      </button>

      {/* Countries */}
      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        onClick={() => setOpenCountry(true)}
        className="pointer-events-auto h-8 w-8 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white text-sm backdrop-blur transition"
      >
        <span aria-hidden style={{ lineHeight: 1 }}>🌍</span>
      </button>

      {/* badges placeholders */}
      <div data-ui="gender-badge" className="sr-only"></div>
      <div data-ui="country-count-badge" className="sr-only"></div>

      {/* Modals */}
      {openGender && (
        <GenderModal 
          open={true} 
          onClose={() => setOpenGender(false)}
          selected={genderToArray(gender)}
          onChange={(vals) => setGender(arrayToGender(vals))}
        />
      )}
      {openCountry && (
        <CountryModal 
          open={true} 
          onClose={() => setOpenCountry(false)}
          selected={countries}
          onChange={(codes) => setCountries(codes)}
        />
      )}
    </div>
  );
}