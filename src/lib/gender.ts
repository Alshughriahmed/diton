// lib/gender.ts
// Normalize user-facing gender inputs to a tight enum.
// Input examples accepted (case-insensitive): 
//   "male","m","man", "female","f","woman", "couples","couple","c",
//   "lgbt","l","gay","bi","queer", "everyone","all","any","*",""
// Output enum: "m" | "f" | "c" | "l" | "u"

export type GenderNorm = "m" | "f" | "c" | "l" | "u";

/** Normalize arbitrary gender strings to the compact enum.
 *  everyone/all/empty -> "u" (unrestricted)
 */
export function normalizeGender(v?: unknown): GenderNorm {
  if (v === null || v === undefined) return "u";
  const s0 = String(v).trim();
  if (s0 === "") return "u";
  const s = s0.toLowerCase();

  // unrestricted / everyone
  if (
    s === "everyone" ||
    s === "every" ||
    s === "any" ||
    s === "all" ||
    s === "*" ||
    s === "u" ||
    s === "unrestricted"
  ) {
    return "u";
  }

  // male
  if (s === "male" || s === "m" || s.startsWith("man")) return "m";

  // female
  if (s === "female" || s === "f" || s.startsWith("wom") || s === "woman" || s === "women")
    return "f";

  // couples
  if (s === "couple" || s === "couples" || s === "c" || s.startsWith("pair")) return "c";

  // lgbt
  if (s === "lgbt" || s === "l" || s.includes("gay") || s.includes("queer") || s === "bi")
    return "l";

  return "u";
}

/** Optional helper to present a UI symbol for a normalized gender. */
export function genderSymbol(g: GenderNorm): string {
  switch (g) {
    case "m":
      return "♂︎";
    case "f":
      return "♀︎";
    case "c":
      return "👨‍❤️‍👨";
    case "l":
      return "🏳️‍🌈";
    default:
      return "•";
  }
}
