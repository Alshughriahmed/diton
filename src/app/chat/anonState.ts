// Client-side tiny holder for anonId (used to pin x-anon-id on every RTC request)
let cache: string | null = null;

export function setAnonId(v: string) {
  cache = v;
  try { localStorage.setItem("ditona:anon", v); } catch {}
}
export function getAnonId(): string | null {
  if (cache) return cache;
  try { const s = localStorage.getItem("ditona:anon"); if (s) cache = s; } catch {}
  return cache;
}
