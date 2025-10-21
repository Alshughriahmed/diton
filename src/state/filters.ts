"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFFA } from "@/utils/ffa";
import { asFilterGenders, normalizeGender, type GenderNorm } from "@/lib/gender";

export type GenderOpt = "all" | "male" | "female" | "couple" | "lgbt";

export type FiltersState = {
  // legacy single UI field
  gender: GenderOpt;

  // جديد: اختيارات متعددة بصيغة معيارية m|f|c|l
  genderKeys: GenderNorm[]; // [] = Everyone

  countries: string[];     // ISO-3166 alpha-2; [] = global
  isVip: boolean;

  // يُستخدم من ChatClient دون تغييره:
  filterGendersNorm: () => ("m" | "f" | "c" | "l")[];

  setVip: (v: boolean) => void;
  setGender: (g: GenderOpt) => void;                // يحافظ على التوافق
  setGenderKeys: (keys: unknown) => void;           // المصدَر الجديد للحقيقة
  setCountries: (codes: string[]) => void;
  reset: () => void;
};

function optToNorm(opt: GenderOpt): GenderNorm {
  switch (opt) {
    case "male": return "m";
    case "female": return "f";
    case "couple": return "c";
    case "lgbt": return "l";
    default: return "u";
  }
}

export const useFilters = create<FiltersState>()(
  persist(
    (set, get) => ({
      gender: "all",
      genderKeys: [],         // Everyone
      countries: [],
      isVip: false,

      // Everyone → []; وإلا نعيد genderKeys إن وُجدت، أو من gender القديم.
      filterGendersNorm: () => {
        const keys = get().genderKeys;
        if (Array.isArray(keys) && keys.length > 0) {
          return keys as ("m" | "f" | "c" | "l")[];
        }
        const g = get().gender;
        if (g === "all") return [];
        return asFilterGenders(optToNorm(g), 2) as ("m" | "f" | "c" | "l")[];
      },

      setVip: (v) => set({ isVip: !!v }),

      // يحافظ على التوافق مع الواجهة القديمة التي تضبط حقلًا واحدًا
      setGender: (g) =>
        set((s) => {
          // أثناء الإطلاق FFA مفتوح؛ لاحقًا يمكن تقييد غير الـVIP
          if (!s.isVip && !isFFA()) {
            // نسمح بكل شيء الآن، لكن إن أردتَ إقفالًا لاحقًا، أعِد هذا الحارس
          }
          const norm = optToNorm(g);
          // لو "all" نمسح genderKeys، وإلا نخزن مفتاحًا واحدًا
          const newKeys = norm === "u" ? [] : [norm];
          return { gender: g, genderKeys: newKeys };
        }),

      // المصدر الجديد للحقيقة لاختيار جنسين كحد أقصى
      setGenderKeys: (keys) =>
        set((s) => {
          const list = asFilterGenders(keys, 2) as GenderNorm[]; // ينظّف ويقصّ للأولَين
          // أبقِ gender القديم متوافقًا: 0→all، 1→يعكس المفتاح، 2→لا معنى له في الحقل القديم
          let legacy: GenderOpt = "all";
          if (list.length === 1) {
            const one = list[0];
            legacy =
              one === "m" ? "male" :
              one === "f" ? "female" :
              one === "c" ? "couple" :
              "lgbt";
          }
          return { genderKeys: list, gender: legacy };
        }),

      setCountries: (codes) =>
        set((s) => {
          // أثناء الإطلاق: حتى 15. لاحقًا: يمكن تقييد غير VIP.
          const list = Array.isArray(codes)
            ? codes.slice(0, 15).map((c) => String(c).toUpperCase())
            : [];
          return { countries: list };
        }),

      reset: () => set({ gender: "all", genderKeys: [], countries: [] }),
    }),
    { name: "ditona.filters.v1" }
  )
);
