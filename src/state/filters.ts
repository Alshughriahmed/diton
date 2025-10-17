// src/state/filters.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFFA } from "@/utils/ffa";
import { normalizeGender } from "@/lib/gender";

export type GenderOpt = "all" | "male" | "female" | "couple" | "lgbt";
export type GenderKey = "male" | "female" | "couples" | "lgbt";

function keyToNorm(k: GenderKey): "m" | "f" | "c" | "l" {
  return k === "male" ? "m" : k === "female" ? "f" : k === "couples" ? "c" : "l";
}

export type FiltersState = {
  gender: GenderOpt;              // إبقاءه للتوافق مع الواجهة القديمة
  genderSelections: GenderKey[];  // الجديد: يدعم حتى جنسين
  countries: string[];            // ISO-3166 codes
  isVip: boolean;

  // جاهزة لإرسالها لـ enqueue
  filterGendersNorm: () => ("m" | "f" | "c" | "l")[];

  setVip: (v: boolean) => void;
  setGender: (g: GenderOpt) => void;                 // يضبط أول اختيار فقط للتوافق
  setGenderSelections: (keys: GenderKey[]) => void;  // يضبط قائمة الجنسَين
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
        const sel = get().genderSelections;
        if (sel.length === 0) return [];
        return sel.slice(0, 2).map(keyToNorm);
      },

      setVip: (v) => set({ isVip: !!v }),

      setGender: (g) =>
        set((s) => {
          if (!s.isVip && !isFFA() && g !== "all") return s;
          // عند اختيار جنس واحد من الواجهة القديمة
          const k: GenderKey | null =
            g === "male" ? "male" :
            g === "female" ? "female" :
            g === "couple" ? "couples" :
            g === "lgbt" ? "lgbt" : null;

          return {
            gender: g,
            genderSelections: k ? [k] : [],
          };
        }),

      setGenderSelections: (keys) =>
        set((s) => {
          // إطلاق تجريبي مفتوح: لا نقيّد. لاحقًا اربطه بـ VIP و FFA
          const arr = Array.isArray(keys) ? keys.slice(0, 2) : [];
          // حدّث حقل gender للعرض فقط
          const first = arr[0];
          const g: GenderOpt =
            !first ? "all" :
            first === "male" ? "male" :
            first === "female" ? "female" :
            first === "couples" ? "couple" : "lgbt";

          return { gender: g, genderSelections: arr };
        }),

      setCountries: (codes) =>
        set((s) => {
          if (!s.isVip && !isFFA()) {
            if (!codes?.length || codes.includes("ALL")) return { countries: [] };
            return { countries: codes.slice(0, 1) };
          }
          return { countries: (!codes?.length ? [] : codes.slice(0, 15)) };
        }),

      reset: () => set({ gender: "all", genderSelections: [], countries: [] }),
    }),
    { name: "ditona.filters.v2" }
  )
);
