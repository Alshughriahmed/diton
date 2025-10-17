"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFFA } from "@/utils/ffa";
import { normalizeGender, toFilterGenders } from "@/lib/gender";

export type GenderOpt = "all" | "male" | "female" | "couple" | "lgbt";

export type FiltersState = {
  gender: GenderOpt;          // UI choice for target gender; "all" means everyone
  countries: string[];        // ISO-3166 codes (empty = global)
  isVip: boolean;

  // derived helpers (no persistence impact)
  filterGendersNorm: () => ("m" | "f" | "c" | "l")[]; // ready for enqueue payload

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

      filterGendersNorm: () => {
        const g = get().gender;
        if (g === "all") return [];
        // map UI words → normalized letters
        const norm = normalizeGender(
          g === "couple" ? "couples" : g
        );
        return toFilterGenders(norm) as ("m" | "f" | "c" | "l")[];
      },

      setVip: (v) => set({ isVip: !!v }),

      setGender: (g) =>
        set((s) => {
          // FFA users can choose any gender, non-FFA non-VIP limited to "all"
          if (!s.isVip && !isFFA() && g !== "all") return s;
          return { gender: g };
        }),

      setCountries: (codes) =>
        set((s) => {
          // FFA users can choose freely; non-FFA non-VIP limited to single country
          if (!s.isVip && !isFFA()) {
            // Allow "ALL" or single country selection for non-VIP
            if (!codes?.length || codes.includes("ALL"))
              return { countries: codes || [] };
            // Allow single country selection
            const next = codes.slice(0, 1);
            return { countries: next };
          }
          // VIP or FFA users can select up to 15 countries
          const next = !codes?.length ? [] : codes.slice(0, 15);
          return { countries: next };
        }),

      reset: () => set({ gender: "all", countries: [] }),
    }),
    { name: "ditona.filters.v1" }
  )
);
