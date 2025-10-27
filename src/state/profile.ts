// src/state/profile.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile } from "@/lib/profile";
import { normalizeGender } from "@/lib/gender";

type Store = {
  profile: Profile;
  set: (p: Partial<Profile>) => void;
  setProfile: (p: Profile) => void;
  /** Set only gender with normalization and emit a lightweight event for listeners */
  setGender: (g: unknown) => void;
  reset: () => void;
};

function emitProfileUpdated(detail: any) {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("profile:updated", { detail }));
    }
  } catch {}
}

// Default profile: store gender normalized (m|f|c|l|u). Start as 'u'.
const defaultProfile: Profile = {
  displayName: "",
  gender: normalizeGender("u") as any,
  avatarDataUrl: undefined,
  introEnabled: false,
  introText: "",
  social: { platform: undefined, handle: "" },
  privacy: { hideCountry: false, hideCity: false },
  likes: { showCount: true },
  translation: { enabled: false, language: "en" },
  preferences: {
    gender: "all",
    genderSelections: [],
    countries: [],
    beauty: { enabled: false, strength: 50, brightness: 50, smoothness: 50 },
    masks: { enabled: false, currentMask: "none" },
    camera: { facing: "user" },
  },
};

export const useProfile = create<Store>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,

      set: (p) =>
        set(() => {
          const cur = get().profile;
          const hasGender = Object.prototype.hasOwnProperty.call(p, "gender");
          const nextGender = hasGender ? (normalizeGender((p as any).gender) as any) : (cur as any).gender;
          const next: Profile = { ...cur, ...p, gender: nextGender };
          emitProfileUpdated({ profile: next, changed: p });
          return { profile: next };
        }),

      setProfile: (p) =>
        set(() => {
          const cur = get().profile;
          const nextGender = normalizeGender((p as any).gender) as any;
          const next: Profile = { ...p, gender: nextGender };
          emitProfileUpdated({ profile: next });
          return { profile: next };
        }),

      setGender: (g) => {
        const cur = get().profile;
        const norm = normalizeGender(g) as any;
        if ((cur as any).gender === norm) return;
        const next = { ...cur, gender: norm };
        set({ profile: next });
        emitProfileUpdated({ profile: next, changed: { gender: norm } });
      },

      reset: () => {
        set({ profile: defaultProfile });
        emitProfileUpdated({ profile: defaultProfile, reset: true });
      },
    }),
    { name: "ditona.profile.v1" }
  )
);
