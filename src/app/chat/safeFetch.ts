"use client";

type SafeInit = RequestInit & { timeoutMs?: number };
type AllowedMethod = "GET" | "POST" | "HEAD";

// === helpers to normalize enqueue payload to server schema ===
function normEnqueueBody(input: any): {
  gender: "u";
  country: "XX";
  filterGenders: "all" | "male" | "female";
  filterCountries: string; // "ALL" or CSV
} {
  const b = (input && typeof input === "object") ? input : {};

  let g: string | undefined =
    (b.gender ?? (Array.isArray(b.genders) ? b.genders[0] : undefined)) || "any";
  g = String(g).toLowerCase();
  const filterGenders: "all" | "male" | "female" =
    g === "male" ? "male" : g === "female" ? "female" : "all";

  let cList: string[] | undefined = Array.isArray(b.countries) ? b.countries : undefined;
  let filterCountries =
    typeof b.filterCountries === "string" ? b.filterCountries : undefined;

  if (!filterCountries) {
    if (!cList || cList.length === 0 || cList.includes("ALL")) {
      filterCountries = "ALL";
    } else {
      const csv = cList
        .map((x) => String(x || "").toUpperCase())
        .filter((x) => /^[A-Z]{2}$/.test(x));
      filterCountries = csv.length ? csv.join(",") : "ALL";
    }
  }

  return { gender: "u", country: "XX", filterGenders, filterCountries };
}

// map routes → enforced method
function enforcedMethod(url: string): "GET" | "POST" | undefined {
  if (url.startsWith("/api/age/allow")) return "POST";
  if (url.startsWith("/api/rtc/init")) return "GET";
  if (url.startsWith("/api/rtc/enqueue")) return "POST";
  if (url.startsWith("/api/rtc/matchmake")) return "GET";
  if (url.startsWith("/api/rtc/offer")) return "POST";
  if (url.startsWith("/api/rtc/answer")) return "POST";
  // /api/rtc/ice supports POST and GET; leave as-is.
  return undefined;
}

export default async function safeFetch(input: RequestInfo | URL, init: SafeInit = {}) {
  const url = typeof input === "string" ? input : String(input);
  const isRtc = url.includes("/api/rtc/");

  let method: AllowedMethod = String(init.method || "GET").toUpperCase() as AllowedMethod;

  const must = enforcedMethod(url);
  if (must) method = must as AllowedMethod;

  const ac = new AbortController();
  const ext = init.signal as AbortSignal | undefined;
  if (ext) {
    if (ext.aborted) ac.abort();
    else ext.addEventListener("abort", () => ac.abort(), { once: true });
  }
  const timeout = init.timeoutMs ?? 15000;
  const tm = setTimeout(() => ac.abort(), timeout);

  const headers = new Headers(init.headers || undefined);
  const isApi = url.startsWith("/api/");
  if (isApi && !headers.has("accept")) headers.set("accept", "application/json");

  let body: any = init.body as any;
  if (url.startsWith("/api/rtc/enqueue")) {
    body = normEnqueueBody(typeof body === "string" ? JSON.parse(body || "{}") : body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }

  const finalInit: RequestInit = {
    ...init,
    method,
    headers,
    signal: ac.signal,
    cache: init.cache ?? "no-store",
    credentials: init.credentials ?? (isRtc ? "include" : "same-origin"),
  };

  if (method === "GET" || method === "HEAD") {
    delete (finalInit as any).body;
  } else {
    const hasJsonBody =
      body != null &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob);
    if (hasJsonBody) (finalInit as any).body = JSON.stringify(body);
    else if (typeof body === "string") (finalInit as any).body = body;
  }

  try {
    return await fetch(input as any, finalInit);
  } finally {
    clearTimeout(tm);
  }
}
