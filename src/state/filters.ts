// src/state/filters.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFFA } from "@/utils/ffa";
import { asFilterGenders } from "@/lib/gender";

export type GenderOpt = "all" | "male" | "female" | "couple" | "lgbt";

export type FiltersState = {
  gender: GenderOpt;       // target gender; "all" = everyone
  countries: string[];     // ISO-3166 alpha-2; [] = global
  isVip: boolean;

  // derived helper for enqueue payload
  filterGendersNorm: () => ("m" | "f" | "c" | "l")[];

  setVip: (v: boolean) => void;
  setGender: (g: GenderOpt) => void;
  setCountries: (codes: string[]) => void;
  reset: () => void;
};

export const useFilters = create<FiltersState>()(
  persist(
    (set, get) => ({
      gender: "all",
      countries: [],
      isVip: false,

      // Everyone → []; otherwise normalize via lib/gender with limit=2 (FFA).
      filterGendersNorm: () => {
        const g = get().gender;
        if (g === "all") return [];
        // asFilterGenders يقبل نصوصًا مفردة أو قائمة مفصولة بفواصل
        return asFilterGenders(g, 2) as ("m" | "f" | "c" | "l")[];
      },

      setVip: (v) => set({ isVip: !!v }),

      setGender: (g) =>
        set((s) => {
          // During launch FFA: allow all. Later: lock non-VIP to "all".
          if (!s.isVip && !isFFA() && g !== "all") return s;
          return { gender: g };
        }),

      setCountries: (codes) =>
        set((s) => {
          // During launch FFA: allow up to 15; later: non-VIP single country or global.
          if (!s.isVip && !isFFA()) {
            if (!codes?.length) return { countries: [] };
            return { countries: [String(codes[0] || "").toUpperCase()] };
          }
          const list = Array.isArray(codes) ? codes.slice(0, 15).map((c) => String(c).toUpperCase()) : [];
          return { countries: list };
        }),

      reset: () => set({ gender: "all", countries: [] }),
    }),
    { name: "ditona.filters.v1" }
  )
);
