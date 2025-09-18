"use client";
import { isFFA } from "@/utils/ffa";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { GenderKey } from "./GenderModal";
const freeForAll = isFFA();


const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

export default function FilterBar() {
  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  return (
    <div className="absolute top-2 right-2 z-[40] flex items-center gap-2">
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() => setOpenGender(true)}
        className="h-9 w-9 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white backdrop-blur"
      >
        <span aria-hidden className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400">⚧</span>
      </button>

      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        onClick={() => setOpenCountry(true)}
        className="h-9 w-9 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white backdrop-blur"
      >
        <span aria-hidden>🌍</span>
      </button>

      {openGender && (
        <GenderModal 
          open={true} 
          onClose={() => setOpenGender(false)}
          selected={selectedGenders}
          onChange={setSelectedGenders}
        />
      )}
      {openCountry && (
        <CountryModal 
          open={true} 
          onClose={() => setOpenCountry(false)}
          selected={selectedCountries}
          onChange={setSelectedCountries}
        />
      )}
    </div>
  );
}