// Auto-fix: ensure pairId is sent and remove non-null assertions
"use client";
type DC = RTCDataChannel | null | undefined;

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && (crypto as any).subtle) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0; for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return "faux-" + (h >>> 0).toString(16);
}

function globals(): { pairId?: string; dc?: DC } {
  const w = globalThis as any;
  return { pairId: w?.__ditonaPairId ?? w?.__pairId ?? w?.pairId, dc: w?.__ditonaDataChannel ?? w?.__dataChannel };
}

async function apiToggleLike(idempKey: string, pairId: string) {
  const res = await fetch("/api/like", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-idempotency": idempKey },
    body: JSON.stringify({ op: "toggle", pairId }),
    cache: "no-store",
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Like API failed: " + res.status);
  return json as { ok?: boolean; duplicate?: boolean };
}

/** API-first then DC notify. Falls back to globals. */
export async function likeApiThenDc(inputPairId?: string, inputDc?: DC) {
  const g = globals();
  const pair = String(inputPairId ?? g.pairId ?? "unknown");
  const dc = inputDc ?? g.dc;

  const key = await sha256Hex(crypto.randomUUID());
  const r = await apiToggleLike(key, pair);

  try { if (dc && dc.readyState === "open") { dc.send(JSON.stringify({ type: "like:toggled", payload: { pairId: pair } })); } } catch {}
  return r;
}
