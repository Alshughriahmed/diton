/**
 * ICE grace: allow 204 instead of 403 for up to 5s after Next/Stop for same anon.
 * Relies on header x-anon-id and x-last-stop-ts (ms epoch) set by client; server can also set cookie in later phase.
 */
export function allowIceGrace(h: Headers, now=Date.now()){
  const anon = h.get("x-anon-id");
  const last = Number(h.get("x-last-stop-ts") || "0");
  if (!anon || !last) return false;
  return (now - last) <= 5000;
}
