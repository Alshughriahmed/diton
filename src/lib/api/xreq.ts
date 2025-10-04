type J = any;

function isReq(v: any): v is Request {
  return v && typeof v === "object" && v.headers && typeof v.headers.get === "function";
}

export function jsonEcho(a: J, b?: J | ResponseInit, c?: ResponseInit): Response {
  let req: Request | undefined;
  let body: J = {};
  let init: ResponseInit | undefined;

  if (isReq(a)) {
    req = a as Request;
    // (req, body, init?) أو (req, init فقط)
    if (b && !("headers" in (b as any)) && !("status" in (b as any))) {
      body = b as J;
      init = c;
    } else {
      body = {};
      init = b as ResponseInit | undefined;
    }
  } else {
    // (body, init?)
    body = a as J;
    init = b as ResponseInit | undefined;
  }

  const reqId =
    req?.headers?.get("x-req-id") ||
    (() => { try { const u = new Uint8Array(16); crypto.getRandomValues(u); return Array.from(u).map(x=>x.toString(16).padStart(2,"0")).join(""); } catch { return String(Date.now()); } })();

  const headers = new Headers(init?.headers || {});
  headers.set("content-type","application/json");
  headers.set("Cache-Control","no-store");
  headers.set("x-req-id", String(reqId));

  return new Response(JSON.stringify(body ?? {}), { ...(init||{}), status: init?.status ?? 200, headers });
}

// مساعد لضمان no-store
export const __noStore = <T extends Response>(r: T): T => {
  try { (r as any).headers?.set?.("Cache-Control","no-store"); } catch {}
  return r;
};
