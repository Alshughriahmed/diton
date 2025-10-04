export function jsonEcho(
  body: any = {},
  init?: ResponseInit,
  req?: Request
): Response {
  const reqId = req?.headers?.get("x-req-id") || cryptoRandom();
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  headers.set("Cache-Control", "no-store");
  if (reqId) headers.set("x-req-id", String(reqId));
  return new Response(JSON.stringify(body ?? {}), {
    status: init?.status ?? 200,
    headers
  });
}

export function __noStore(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return new Response(res.body, { status: res.status, headers: h });
}

export function echoXReqId(req: Request, res: Response): Response {
  try {
    const reqId = req.headers.get("x-req-id") || cryptoRandom();
    const h = new Headers(res.headers);
    h.set("x-req-id", String(reqId));
    h.set("Cache-Control", "no-store");
    return new Response(res.body, { status: res.status, headers: h });
  } catch { return res; }
}

function cryptoRandom(): string {
  try {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("");
  } catch { return String(Date.now()); }
}
