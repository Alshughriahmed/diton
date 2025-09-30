const buckets = new Map<string, {count:number; reset:number}>();
export function allow(id: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || now > b.reset) {
    buckets.set(id, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, reset: now + windowMs };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, reset: b.reset };
  b.count++;
  return { ok: true, remaining: limit - b.count, reset: b.reset };
}
export function ipFrom(req: Request) {
  const ff = req.headers.get("x-forwarded-for") || "";
  return ff.split(",")[0].trim() || "local";
}
