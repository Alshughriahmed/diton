// تطبيع الجنس وإرجاع شارة عرض متوافقة مع الواجهة.

export type GenderNorm = "m" | "f" | "c" | "l" | "u";

// everyone/all/empty → "u" (غير مقيّد)
export function normalizeGender(v?: unknown): GenderNorm {
  if (v === null || v === undefined) return "u";
  const s0 = String(v).trim();
  if (s0 === "") return "u";
  const s = s0.toLowerCase();

  if (s === "everyone" || s === "every" || s === "any" || s === "all" || s === "*" || s === "u" || s === "unrestricted") return "u";
  if (s === "male" || s === "m" || s.startsWith("man")) return "m";
  if (s === "female" || s === "f" || s.startsWith("wom") || s === "woman" || s === "women") return "f";
  if (s === "couple" || s === "couples" || s === "c" || s.startsWith("pair")) return "c";
  if (s === "lgbt" || s === "l" || s.includes("gay") || s.includes("queer") || s === "bi") return "l";
  return "u";
}

/** تحويل قيمة واحدة أو مصفوفة إلى مصفوفة جاهزة للإرسال في الفلاتر */
export function toFilterGenders(input?: GenderNorm | GenderNorm[] | null): Array<"m"|"f"|"c"|"l"> {
  const arr = Array.isArray(input) ? input : (input ? [input] : []);
  const out = new Set<"m"|"f"|"c"|"l">();
  for (const it of arr) {
    const n = normalizeGender(it);
    if (n === "u") continue;
    if (n === "m" || n === "f" || n === "c" || n === "l") out.add(n);
  }
  return Array.from(out);
}

// رمز واجهة بسيط عند الحاجة
export function genderSymbol(g: GenderNorm): string {
  switch (g) {
    case "m": return "♂︎";
    case "f": return "♀︎";
    case "c": return "👨‍❤️‍👨";
    case "l": return "🏳️‍🌈";
    default:  return "•";
  }
}

export type GenderBadge = { label: string; cls: string };
export function genderBadge(input?: unknown): GenderBadge {
  const g = normalizeGender(input);
  switch (g) {
    case "m": return { label: "♂︎", cls: "text-blue-800" };
    case "f": return { label: "♀︎", cls: "text-red-500" };
    case "c": return { label: "👨‍❤️‍👨", cls: "text-rose-400" };
    case "l": return { label: "🏳️‍🌈", cls: "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-600 bg-clip-text text-transparent" };
    default:  return { label: "•", cls: "text-neutral-400" };
  }
}
export const genderBadgeSymbol = genderSymbol;
