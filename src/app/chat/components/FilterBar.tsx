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

export default function FilterBar() {
  const ffa = useFFA();
  const { isVip } = useVip();
  const router = useRouter();

  // مصادر الحقيقة
  const filters: any = useFilters() as any;
  const profileStore: any = useProfile() as any;

  // الحالة الحالية من المتجر
  const currentGender: GenderKey =
    (filters?.gender as GenderKey) ?? "everyone";
  const currentCountries: string[] = Array.isArray(filters?.countries)
    ? filters.countries
    : [];

  // حالة محلية لواجهات المودال
  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderKey[]>(
    [currentGender]
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    currentCountries
  );

  // السماحية: نسمح بالفتح دائمًا. إن أردت الدفع لميزة، استخدم التوجيه فقط.
  const allowOpen = true;

  // تطبيق تغييرات الجنس مع التطبيع + مزامنة profile
  function applyGender(keys: GenderKey[]) {
    // Everyone يعني عدم تقييد: نخزن "everyone" في الفلاتر و [] في المطابقة
    const picked: GenderKey =
      keys.includes("everyone") || keys.length === 0
        ? "everyone"
        : (keys[0] as GenderKey);

    const norm = (normalizeGender(picked) || "u") as string;

    // تحديث متجر الفلاتر
    filters?.setGender?.(picked);
    // مزامنة الملف الشخصي كمصدر حقيقة
    profileStore?.setGender?.(norm);
    profileStore?.setProfile?.((p: any) => ({ ...(p || {}), gender: norm }));

    setSelectedGenders([picked]);
  }

  // تطبيق تغييرات الدول
  function applyCountries(codes: string[]) {
    filters?.setCountries?.(codes);
    setSelectedCountries(codes);
  }

  // توجيه لـ VIP إذا أردت تقييدًا لاحقًا
  function guardOr(fn: () => void) {
    if (!allowOpen) return;
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
            // مزامنة الحالة عند الفتح
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
          selected={selectedGenders}
          onChange={(value) => {
            // VIP قد يسمح بأكثر من اختيار. نبقي التخزين مفردًا مع Everyone كحالة عدم تقييد.
            if (!isVip && value.length > 1) value = [value[0]];
            applyGender(value as GenderKey[]);
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
