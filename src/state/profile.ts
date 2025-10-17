'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/lib/profile';
import { normalizeGender } from '@/lib/gender';

type Store = {
  profile: Profile;
  set: (p: Partial<Profile>) => void;
  setProfile: (p: Profile) => void;

  /** Set only gender with normalization and emit a lightweight event for listeners */
  setGender: (g: unknown) => void;

  reset: () => void;
};

// Default profile. Keep fields as-is, but store gender normalized (m|f|c|l|u).
const defaultProfile: Profile = {
  displayName: '',
  // normalized form; if Profile.gender is a plain string type this remains valid
  gender: normalizeGender('male') as any,
  avatarDataUrl: undefined,
  introEnabled: false,
  introText: '',
  social: { platform: undefined, handle: '' },
  privacy: { hideCountry: false, hideCity: false },
  likes: { showCount: true },
  translation: { enabled: false, language: 'en' },
  preferences: {
    gender: 'all',
    genderSelections: [],
    countries: [],
    beauty: {
      enabled: false,
      strength: 50,
      brightness: 50,
      smoothness: 50,
    },
    masks: {
      enabled: false,
      currentMask: 'none',
    },
    camera: {
      facing: 'user',
    },
  },
};

export const useProfile = create<Store>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,

      set: (p) => set({ profile: { ...get().profile, ...p } }),

      setProfile: (p) => set({ profile: p }),

      setGender: (g) => {
        const norm = normalizeGender(g) as any;
        set({ profile: { ...get().profile, gender: norm } });
        // notify listeners (dcMetaResponder, HUD, etc.)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('profile:updated', { detail: { gender: norm } })
          );
        }
      },

      reset: () => set({ profile: defaultProfile }),
    }),
    { name: 'ditona.profile.v1' }
  )
);
