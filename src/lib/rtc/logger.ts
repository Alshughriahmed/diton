type AnyRec = Record<string, any>;
export function logRTC(event: string, status: number, extra?: AnyRec) {
  try { console.log(`[rtc] ${event}`, status, extra ?? ""); } catch {}
}
export function logJson(obj: AnyRec) {
  try { console.log("[rtc]", JSON.stringify(obj)); } catch {}
}
export default logRTC;
