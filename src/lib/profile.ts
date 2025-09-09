export type GenderOpt = 'male'|'female'|'couple'|'lgbt'|'other';
export type LangOpt = 'ar'|'en'|'de'|'fr'|'es'|'it'|'ru'|'tr'|'fa';

export interface Social {
  platform?: 'instagram'|'snap'|'onlyfans';
  handle?: string;
}

export interface Profile {
  displayName: string;
  avatarDataUrl?: string;        // نستخدم DataURL مؤقتًا لتقليل التكلفة
  gender: GenderOpt;
  introEnabled: boolean;
  introText: string;
  social?: Social;
  privacy: { hideCountry: boolean; hideCity: boolean };
  likes: { showCount: boolean };
  translation: { enabled: boolean; language?: LangOpt };
  preferences?: {
    gender?: string;
    genderSelections?: string[];
    countries?: string[];
    beauty?: {
      enabled: boolean;
      strength: number;
      brightness: number;
      smoothness: number;
    };
    masks?: {
      enabled: boolean;
      currentMask: string;
    };
    camera?: {
      facing: 'user' | 'environment';
    };
  };
}