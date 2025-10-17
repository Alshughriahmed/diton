// src/state/filters.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFFA } from "@/utils/ffa";

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

function normLetter(g: GenderOpt): "m" | "f" | "c" | "l" | null {
  if (g === "male") return "m";
  if (g === "female") return "f";
  if (g === "couple") return "c";
  if (g === "lgbt") return "l";
  return null; // "all"
}

export const useFilters = create<FiltersState>()(
  persist(
    (set, get) => ({
      gender: "all",
      countries: [],
      isVip: false,

      filterGendersNorm: () => {
        const g = get().gender;
        const n = normLetter(g);
        return n ? [n] : [];
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
            return { countries: codes.slice(0, 1) };
          }
          return { countries: Array.isArray(codes) ? codes.slice(0, 15) : [] };
        }),

      reset: () => set({ gender: "all", countries: [] }),
    }),
    { name: "ditona.filters.v1" }
  )
);
