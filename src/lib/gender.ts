// src/lib/gender.ts
export type GenderNorm = "m" | "f" | "c" | "l" | "u"; // male, female, couples, lgbt, unknown/everyone

const SYNS: Record<GenderNorm, string[]> = {
  m: ["m", "male", "man", "boy", "masculine"],
  f: ["f", "female", "woman", "girl", "feminine"],
  c: ["c", "couple", "couples", "coupled", "pair"],
  l: ["l", "lgbt", "lgbtq", "gay", "lesbian", "bi", "trans", "queer"],
  u: ["u", "everyone", "all", "any", "unknown", "unspecified", "every", ""],
};

const VALID_FILTERS: GenderNorm[] = ["m", "f", "c", "l"]; // "u" never sent as a filter constraint

function normToken(x: unknown): string {
  if (x == null) return "";
  return String(x).trim().toLowerCase();
}

/** Normalize any user/UI value into one of: "m"|"f"|"c"|"l"|"u". */
export function normalizeGender(v?: unknown): GenderNorm {
  const t = normToken(v);
  for (const k of Object.keys(SYNS) as GenderNorm[]) {
    if (SYNS[k].includes(t)) return k;
  }
  // also accept common abbreviations
  if (t.startsWith("mal")) return "m";
  if (t.startsWith("fem") || t == "w") return "f";
  if (t.startsWith("coupl")) return "c";
  if (t.startsWith("lg") || t.startsWith("queer") || t.startsWith("gay") || t.startsWith("lesb")) return "l";
  return "u";
}

/** Everyone-like flag. Treats "u"/"everyone"/"all"/empty as no constraint. */
export function isEveryone(val?: unknown): boolean {
  const t = normalizeGender(val);
  return t == "u";
}

/**
 * Convert a UI field into a normalized filter array.
 * - Accepts: undefined | "everyone" | "m" | "male,female" | string[]
 * - Returns only items in ["m","f","c","l"] and de-duplicates.
 * - Returns [] for Everyone/All or when input has no valid tokens.
 * - Enforces optional `limit` (default 2) for FFA/VIP parity.
 */
export function asFilterGenders(input?: unknown, limit = 2): GenderNorm[] {
  const push: GenderNorm[] = [];
  const add = (g: unknown) => {
    const n = normalizeGender(g);
    if (n !== "u" && VALID_FILTERS.includes(n) && !push.includes(n)) push.push(n);
  };
  if (Array.isArray(input)) {
    for (const it of input) add(it);
  } else if (typeof input === "string") {
    if (isEveryone(input)) return [];
    for (const tok of input.split(/[,\s]+/)) add(tok);
  } else if (input != null) {
    add(input);
  }
  if (push.length === 0) return [];
  if (Number.isFinite(limit) && limit > 0) return push.slice(0, limit as number);
  return push;
}

/** UI helpers kept minimal. */
export function genderLabel(g: unknown): string {
  switch (normalizeGender(g)) {
    case "m": return "Male";
    case "f": return "Female";
    case "c": return "Couples";
    case "l": return "LGBTQ+";
    default: return "Everyone";
  }
}
export function genderSymbol(g: unknown): string {
  switch (normalizeGender(g)) {
    case "m": return "♂";
    case "f": return "♀";
    case "c": return "❤";
    case "l": return "🏳️‍🌈";
    default: return "•";
  }
}
