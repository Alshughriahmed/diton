type Any = any;

export function jsonEcho(body?: Any, init?: ResponseInit): Response;
export function jsonEcho(body?: Any, req?: Request, init?: ResponseInit): Response;
export function jsonEcho(body?: Any, b?: any, c?: any): Response {
  let req: Request | undefined;
  let init: ResponseInit | undefined;
  if (b && (typeof b.status === "number" || b?.headers)) {
    init = b as ResponseInit;
  } else {
    req = b as Request;
    init = c as ResponseInit;
  }
  const reqId =
    (req && req.headers?.get?.("x-req-id")) ||
    (typeof crypto !== "undefined"
      ? (() => { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join(""); })()
      : String(Date.now()));
  const headers = new Headers(init?.headers || {});
  if (!headers.has("content-type")) headers.set("content-type","application/json");
  headers.set("Cache-Control","no-store");
  headers.set("x-req-id", String(reqId));
  return new Response(JSON.stringify(body ?? {}), { status: init?.status ?? 200, headers });
}

export function echoXReqId(req: Request, res: Response): Response {
  try {
    const reqId = req.headers.get("x-req-id") || "";
    const h = new Headers(res.headers);
    if (reqId) h.set("x-req-id", reqId);
    h.set("Cache-Control","no-store");
    return new Response(res.body, { status: res.status, headers: h });
  } catch { return res; }
}
