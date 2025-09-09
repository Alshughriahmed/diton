'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/lib/profile';

type Store = {
  profile: Profile;
  set: (p: Partial<Profile>) => void;
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
};

export const useProfile = create<Store>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      set: (p) => set({ profile: { ...get().profile, ...p } }),
      reset: () => set({ profile: defaultProfile }),
    }),
    { name: 'ditona.profile.v1' }
  )
);