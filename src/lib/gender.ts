// src/lib/gender.ts
export type Gender = "male" | "female" | "couple" | "lgbt";

export function normalizeGender(v: any): Gender | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return undefined;

  // EN
  if (s === "m" || s.startsWith("male") || s.includes("♂")) return "male";
  if (s === "f" || s.startsWith("female") || s.includes("♀")) return "female";
  if (s.includes("couple") || s.includes("pair") || s.includes("👨") || s.includes("👩")) return "couple";
  if (s.includes("lgbt") || s.includes("pride") || s.includes("🏳️‍🌈") || s.includes("gay")) return "lgbt";

  // AR fallbacks
  if (s.includes("ذكر")) return "male";
  if (s.includes("أنث") || s.includes("انث")) return "female";
  if (s.includes("زوج")) return "couple";
  if (s.includes("مثلي")) return "lgbt";

  return undefined;
}

export function genderBadge(g?: string): { label: string; cls: string } | null {
  const t = normalizeGender(g);
  if (t === "male") return { label: "Male ♂️", cls: "text-blue-800" };        // أزرق غامق
  if (t === "female") return { label: "Female ♀️", cls: "text-red-600" };     // أحمر فاقع
  if (t === "couple") return { label: "Couple 👨‍❤️‍👨", cls: "text-red-500" };// أحمر فاتح
  if (t === "lgbt")
    return {
      label: "LGBT 🏳️‍🌈",
      cls: "bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent",
    };
  return null;
}
