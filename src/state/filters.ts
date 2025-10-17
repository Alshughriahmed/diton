"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFFA } from "@/utils/ffa";
import { normalizeGender, toFilterGenders } from "@/lib/gender";

export type GenderOpt = "all" | "male" | "female" | "couple" | "lgbt";

export type FiltersState = {
  gender: GenderOpt;                // توافق قديم
  genderSelections: GenderOpt[];    // حتى جنسين
  countries: string[];
  isVip: boolean;

  filterGendersNorm: () => ("m" | "f" | "c" | "l")[];

  setVip: (v: boolean) => void;
  setGender: (g: GenderOpt) => void;
  setGenderSelections: (g: GenderOpt[]) => void;
  setCountries: (codes: string[]) => void;
  reset: () => void;
};

export const useFilters = create<FiltersState>()(
  persist(
    (set, get) => ({
      gender: "all",
      genderSelections: [],
      countries: [],
      isVip: false,

      filterGendersNorm: () => {
        const { gender, genderSelections } = get();
        const base: GenderOpt[] =
          genderSelections?.length ? genderSelections
          : (gender === "all" ? [] : [gender]);
        const norms = base.map(g =>
          normalizeGender(g === "couple" ? "couples" : g)
        );
        // يزيل "u" ويمنع التكرار
        return toFilterGenders(norms);
      },

      setVip: (v) => set({ isVip: !!v }),

      setGender: (g) =>
        set((s) => {
          // أثناء الإطلاق المفتوح لا نقيّد. عند القفل أعِد شرط VIP/FFA هنا.
          const nextSel = g === "all" ? [] : [g];
          return { gender: g, genderSelections: nextSel };
        }),

      setGenderSelections: (g) =>
        set((_s) => {
          const arr = Array.isArray(g) ? g.slice(0, 2) : [];
          return {
            genderSelections: arr,
            gender: arr.length ? arr[0] : "all",
          };
        }),

      setCountries: (codes) =>
        set((s) => {
          if (!s.isVip && !isFFA()) {
            if (!codes?.length || codes.includes("ALL")) return { countries: [] };
            return { countries: codes.slice(0, 1) };
          }
          return { countries: Array.isArray(codes) ? codes.slice(0, 15) : [] };
        }),

      reset: () => set({ gender: "all", genderSelections: [], countries: [] }),
    }),
    { name: "ditona.filters.v2" }
  )
);
