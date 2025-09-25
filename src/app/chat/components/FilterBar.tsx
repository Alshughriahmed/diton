"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useFFA } from "@/hooks/useFFA";
import type { GenderKey } from "./GenderModal";


const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

export default function FilterBar() {
  const freeForAll = useFFA();
  
  // FFA runtime detection
  const ffa = (typeof window !== "undefined" && (window as any).__vip?.FREE_FOR_ALL == 1);
  if (ffa) console.log("FFA_FORCE: enabled");
  
  // DataChannel state for button guards  
  const dc = (globalThis as any).__ditonaDataChannel;
  const filtersEnabled = ffa || dc?.readyState === "open";
  
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
        disabled={!filtersEnabled}
        onClick={() => filtersEnabled && setOpenGender(true)}
        title={!filtersEnabled ? "Available during active connection or FFA" : "Gender filters"}
        className={`h-9 w-9 grid place-items-center rounded-xl ${!filtersEnabled ? 'bg-black/15 opacity-50 cursor-not-allowed' : 'bg-black/30 hover:bg-black/40'} text-white backdrop-blur`}
      >
        <span aria-hidden className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400">⚧</span>
      </button>

      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        disabled={!filtersEnabled}
        onClick={() => filtersEnabled && setOpenCountry(true)}
        title={!filtersEnabled ? "Available during active connection or FFA" : "Country filters"}
        className={`h-9 w-9 grid place-items-center rounded-xl ${!filtersEnabled ? 'bg-black/15 opacity-50 cursor-not-allowed' : 'bg-black/30 hover:bg-black/40'} text-white backdrop-blur`}
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