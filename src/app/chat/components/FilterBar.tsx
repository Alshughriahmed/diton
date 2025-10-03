"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFFA } from '@/lib/useFFA';
import { useVip } from '@/hooks/useVip';
import type { GenderKey } from "./GenderModal";

const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

export default function FilterBar() {
  const ffa = useFFA();
  const { isVip } = useVip();
  const router = useRouter();
  
  const dc: RTCDataChannel | null = (globalThis as any).__ditonaDataChannel ?? null;
  const connected = !!dc && dc.readyState === "open";
  const buttonEnabled = ffa || connected || isVip;
  
  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const handleFilterSelection = (filterType: 'gender' | 'country', value: any) => {
    const canApply = ffa || isVip;
    if (canApply) {
      // Apply filter logic here
      if (filterType === 'gender') {
        setSelectedGenders(value);
      } else {
        setSelectedCountries(value);
      }
    } else {
      router.push("/plans?ref=filters");
    }
  };

  return (
    <div className="absolute top-2 right-2 z-[40] flex items-center gap-2">
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        disabled={!buttonEnabled}
        onClick={() => setOpenGender(true)}
        title={!buttonEnabled ? "Available during active connection or FFA" : "Gender filters"}
        className={`h-9 w-9 grid place-items-center rounded-xl ${!buttonEnabled ? 'bg-black/15 opacity-50 cursor-not-allowed' : 'bg-black/30 hover:bg-black/40'} text-white backdrop-blur`}
      >
        <span aria-hidden className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400">⚧</span>
      </button>

      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        disabled={!buttonEnabled}
        onClick={() => setOpenCountry(true)}
        title={!buttonEnabled ? "Available during active connection or FFA" : "Country filters"}
        className={`h-9 w-9 grid place-items-center rounded-xl ${!buttonEnabled ? 'bg-black/15 opacity-50 cursor-not-allowed' : 'bg-black/30 hover:bg-black/40'} text-white backdrop-blur`}
      >
        <span aria-hidden>🌍</span>
      </button>

      {openGender && (
        <GenderModal 
          open={true} 
          onClose={() => setOpenGender(false)}
          selected={selectedGenders}
          onChange={(value) => handleFilterSelection('gender', value)}
        />
      )}
      {openCountry && (
        <CountryModal 
          open={true} 
          onClose={() => setOpenCountry(false)}
          selected={selectedCountries}
          onChange={(value) => handleFilterSelection('country', value)}
        />
      )}
    </div>
  );
}