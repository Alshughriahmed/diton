// DitonaChat: BEGIN gender-utils
export type Gender = 'male' | 'female' | 'couple' | 'lgbt' | 'unknown';

export const GENDER_ICON: Record<Gender, string> = {
  male: '♂',
  female: '♀', 
  couple: '💞',
  lgbt: '🌈',
  unknown: '•'
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  couple: 'Couple', 
  lgbt: 'LGBT',
  unknown: 'Unknown'
};

export const GENDER_CLASSES: Record<Gender, string> = {
  male: 'bg-blue-600 text-white',
  female: 'bg-red-600 text-white',
  couple: 'bg-rose-600 text-white',
  lgbt: 'bg-fuchsia-600 text-white',
  unknown: 'bg-gray-600 text-white'
};
// DitonaChat: END gender-utils