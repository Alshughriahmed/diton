export const GENDERS = [
  { 
    value: "all", 
    label: "All Genders", 
    icon: "🌐", 
    color: "text-gray-600" 
  },
  { 
    value: "male", 
    label: "♂️ Male", 
    icon: "♂️", 
    color: "text-blue-800" 
  },
  { 
    value: "female", 
    label: "♀️ Female", 
    icon: "♀️", 
    color: "text-red-600" 
  },
  { 
    value: "couple", 
    label: "💑 Couple", 
    icon: "💑", 
    color: "text-red-500" 
  },
  { 
    value: "lgbt", 
    label: "🌈 LGBT", 
    icon: "🌈", 
    color: "text-rainbow bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent" 
  }
] as const;

export type Gender = typeof GENDERS[number]["value"];

export function getGenderStyle(gender: Gender) {
  const found = GENDERS.find(g => g.value === gender);
  return found ? { icon: found.icon, color: found.color, label: found.label } : { icon: "🌐", color: "text-gray-600", label: "Unknown" };
}
