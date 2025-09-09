'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/lib/profile';

type Store = {
  profile: Profile;
  set: (p: Partial<Profile>) => void;
  setProfile: (p: Profile) => void;
  reset: () => void;
};

const defaultProfile: Profile = {
  displayName: '',
  gender: 'male',
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
      smoothness: 50
    },
    masks: {
      enabled: false,
      currentMask: 'none'
    },
    camera: {
      facing: 'user'
    }
  }
};

export const useProfile = create<Store>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      set: (p) => set({ profile: { ...get().profile, ...p } }),
      setProfile: (p) => set({ profile: p }),
      reset: () => set({ profile: defaultProfile }),
    }),
    { name: 'ditona.profile.v1' }
  )
);