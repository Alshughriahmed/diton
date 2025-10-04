export function jsonEcho(
  body: any = {},
  req?: Request,
  init?: ResponseInit
): Response {
  const reqId = (req?.headers?.get("x-req-id") || cryptoRandom()) as string;
  const headers = new Headers(init?.headers || {});
  if (!headers.has("content-type")) headers.set("content-type","application/json");
  headers.set("Cache-Control","no-store");
  headers.set("x-req-id", reqId);
  return new Response(JSON.stringify(body ?? {}), { status: init?.status ?? 200, headers });
}

export function echoXReqId(req: Request, res: Response): Response {
  try {
    const reqId = req.headers.get("x-req-id") || cryptoRandom();
    const h = new Headers(res.headers);
    h.set("x-req-id", String(reqId));
    h.set("Cache-Control","no-store");
    return new Response(res.body, { status: res.status, headers: h });
  } catch { return res; }
}

function cryptoRandom(): string {
  try {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("");
  } catch { return String(Date.now()); }
}
