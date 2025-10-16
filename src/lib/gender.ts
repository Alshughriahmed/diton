// src/lib/gender.ts
// تطبيع الجنس وإرجاع شارة عرض متوافقة مع الواجهة.

// القيم المعيارية المدمجة
export type GenderNorm = "m" | "f" | "c" | "l" | "u";

// everyone/all/empty → "u" (غير مقيّد)
export function normalizeGender(v?: unknown): GenderNorm {
  if (v === null || v === undefined) return "u";
  const s0 = String(v).trim();
  if (s0 === "") return "u";
  const s = s0.toLowerCase();

  // غير مقيّد
  if (
    s === "everyone" || s === "every" || s === "any" || s === "all" ||
    s === "*" || s === "u" || s === "unrestricted"
  ) return "u";

  // ذكر
  if (s === "male" || s === "m" || s.startsWith("man")) return "m";

  // أنثى
  if (s === "female" || s === "f" || s.startsWith("wom") || s === "woman" || s === "women")
    return "f";

  // زوج/ثنائي
  if (s === "couple" || s === "couples" || s === "c" || s.startsWith("pair")) return "c";

  // LGBT
  if (s === "lgbt" || s === "l" || s.includes("gay") || s.includes("queer") || s === "bi")
    return "l";

  return "u";
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

// شكل الشارة المتوقّع من الواجهة
export type GenderBadge = { label: string; cls: string };

/**
 * شارة متوافقة مع PeerOverlay:
 * - label: الرمز
 * - cls: كلاس Tailwind للّون
 * تقبل undefined والنصوص الخام.
 */
export function genderBadge(input?: unknown): GenderBadge {
  const g = normalizeGender(input);
  switch (g) {
    case "m":
      return { label: "♂︎", cls: "text-blue-800" };       // أزرق غامق
    case "f":
      return { label: "♀︎", cls: "text-red-500" };        // أحمر فاقع
    case "c":
      return { label: "👨‍❤️‍👨", cls: "text-rose-400" };  // أحمر فاتح
    case "l":
      // تدرّج قوس قزح كنص ملوّن
      return {
        label: "🏳️‍🌈",
        cls: "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-600 bg-clip-text text-transparent"
      };
    default:
      return { label: "•", cls: "text-neutral-400" };
  }
}

// إبقاء alias قديم إن وُجد استيراد مباشر للرمز فقط
export const genderBadgeSymbol = genderSymbol;
