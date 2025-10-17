// src/lib/gender.ts
// تطبيع الجنس وعرض شارات متوافقة مع الواجهة بدون تبعيات إضافية.

/** القيمة المعيارية */
export type GenderNorm = "m" | "f" | "c" | "l" | "u";

/* ======================== قواعد التطبيع ======================== */
const MALE = new Set(["male","m","man","men","boy","ذكر","رجل","رجال"]);
const FEMALE = new Set(["female","f","woman","women","girl","انثى","امرأة","نساء","بنت","امراة"]);
const COUPLES = new Set(["couple","couples","c","pair","pairs","ثنائي","زوج","زوجين"]);
const LGBT = new Set(["lgbt","l","gay","queer","bi","bisexual","lesbian","trans","مثلي","مثليات","ترانس"]);
const EVERYONEish = new Set(["everyone","every","any","all","*","u","unrestricted","anyone","الجميع"]);

/** everyone/all/empty => "u" */
export function normalizeGender(v?: unknown): GenderNorm {
  if (v == null) return "u";
  const s = String(v).trim().toLowerCase();
  if (!s) return "u";

  if (EVERYONEish.has(s)) return "u";
  if (MALE.has(s) || s.startsWith("man")) return "m";
  if (FEMALE.has(s) || s.startsWith("wom")) return "f";
  if (COUPLES.has(s) || s.startsWith("pair")) return "c";
  if (LGBT.has(s)) return "l";

  return "u";
}

/** selfGender يجب أن يكون ضمن m|f|c|l، وإلا "u" */
export function normalizeSelfGender(v?: unknown): GenderNorm {
  const g = normalizeGender(v);
  return g === "u" ? "u" : g;
}

/** تحويل اختيار الفلتر إلى مصفوفة إرسال: everyone ⇒ []، غير ذلك ⇒ [g] */
export function toFilterGenders(input?: unknown): GenderNorm[] {
  const g = normalizeGender(input);
  return g === "u" ? [] : [g];
}

/* ======================== العرض ======================== */

/** رمز واجهة مبسّط */
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

/** شارة متوافقة مع PeerOverlay */
export function genderBadge(input?: unknown): GenderBadge {
  const g = normalizeGender(input);
  switch (g) {
    case "m": return { label: "♂︎",        cls: "text-blue-800" }; // أزرق غامق
    case "f": return { label: "♀︎",        cls: "text-red-500"  }; // أحمر فاقع
    case "c": return { label: "👨‍❤️‍👨",   cls: "text-rose-400" }; // أحمر فاتح
    case "l": return {
      label: "🏳️‍🌈",
      cls: "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-600 bg-clip-text text-transparent"
    };
    default:  return { label: "•",         cls: "text-neutral-400" };
  }
}

/* ======================== أدوات مساعدة ======================== */

export const isEveryone = (v?: unknown) => normalizeGender(v) === "u";

/** إبقاء alias قديم إن وُجد استيراد مباشر للرمز فقط */
export const genderBadgeSymbol = genderSymbol;
