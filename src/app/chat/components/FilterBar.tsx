// src/app/chat/components/FilterBar.tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFFA } from "@/lib/useFFA";
import { useVip } from "@/hooks/useVip";
import { useFilters } from "@/state/filters";
import { useProfile } from "@/state/profile";
import { normalizeGender } from "@/lib/gender";
import type { GenderKey } from "./GenderModal";

const GenderModal = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal = dynamic(() => import("./CountryModal"), { ssr: false });

// GenderKey من المودال لا يضم "everyone"، لذا نوسعه محليًا للواجهة
type UGender = GenderKey | "everyone";

export default function FilterBar() {
  const ffa = useFFA();
  const { isVip } = useVip();
  const router = useRouter();

  const filters: any = useFilters() as any;
  const profileStore: any = useProfile() as any;

  const currentGender: UGender =
    (filters?.gender as UGender) ?? "everyone";
  const currentCountries: string[] = Array.isArray(filters?.countries)
    ? filters.countries
    : [];

  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<UGender[]>(
    [currentGender]
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    currentCountries
  );

  const allowOpen = true;

  function applyGender(keys: UGender[]) {
    // Everyone = عدم تقييد
    const picked: UGender =
      (keys as UGender[]).includes("everyone") || keys.length === 0
        ? "everyone"
        : (keys[0] as UGender);

    const norm = normalizeGender(picked) || "u";

    // خزّن في فلاتر الواجهة كما هي
    filters?.setGender?.(picked as any);
    // وحّد مصدر الحقيقة في البروفايل
    profileStore?.setGender?.(norm);
    profileStore?.setProfile?.((p: any) => ({ ...(p || {}), gender: norm }));

    setSelectedGenders([picked]);
  }

  function applyCountries(codes: string[]) {
    filters?.setCountries?.(codes);
    setSelectedCountries(codes);
  }

  function guardOr(fn: () => void) {
    // افتح دائمًا. إن أردت فرض VIP مستقبلاً استعمل router هنا.
    fn();
  }

  return (
    <div
      className="absolute top-2 right-2 z-50 pointer-events-auto flex items-center gap-2"
      data-ui="filter-bar"
    >
      <button
        type="button"
        data-ui="gender-button"
        aria-label="Gender"
        onClick={() =>
          guardOr(() => {
            setSelectedGenders([currentGender]);
            setOpenGender(true);
          })
        }
        title="Gender filters"
        className="h-9 w-9 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <span aria-hidden className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400">
          ⚧
        </span>
      </button>

      <button
        type="button"
        data-ui="country-button"
        aria-label="Countries"
        onClick={() =>
          guardOr(() => {
            setSelectedCountries(currentCountries);
            setOpenCountry(true);
          })
        }
        title="Country filters"
        className="h-9 w-9 grid place-items-center rounded-xl bg-black/30 hover:bg-black/40 text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <span aria-hidden>🌍</span>
      </button>

      {openGender && (
        <GenderModal
          open={true}
          onClose={() => setOpenGender(false)}
          selected={selectedGenders as GenderKey[]}
          onChange={(value) => {
            let v = Array.isArray(value) ? value : [];
            if (!isVip && v.length > 1) v = [v[0]];
            applyGender(v as UGender[]);
          }}
        />
      )}

      {openCountry && (
        <CountryModal
          open={true}
          onClose={() => setOpenCountry(false)}
          selected={selectedCountries}
          onChange={(value) => {
            applyCountries(Array.isArray(value) ? value : []);
          }}
        />
      )}
    </div>
  );
}
