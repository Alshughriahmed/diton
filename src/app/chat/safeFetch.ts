// src/app/chat/safeFetch.ts
// فرض إرسال الكوكي دائمًا + no-store + x-req-id + مهلة اختيارية
export default async function apiSafeFetch(
  input: RequestInfo | URL,
  init: (RequestInit & { timeoutMs?: number }) = {}
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 12000);

  // رؤوس موحّدة
  const h = new Headers(init.headers || {});
  if (!h.has("x-req-id")) h.set("x-req-id", genId());
  // طلبات العميل ليست مُخزّنة لكن نُصرّح بنية عدم التخزين
  if (!h.has("cache-control")) h.set("cache-control", "no-store");

  try {
    const res = await fetch(input, {
      ...init,
      cache: "no-store",
      credentials: "include",   // << ضمان الكوكي
      keepalive: true,
      signal: controller.signal,
      headers: h,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4); }
