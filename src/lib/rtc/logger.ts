type Any = Record<string, any>;

export function logRTC(a: string | Any, b?: number | Any, c?: Any): void {
  try {
    if (typeof a === "string") {
      const status = typeof b === "number" ? b : 0;
      const extra  = typeof b === "number" ? c : b;
      console.log("[rtc]", a, status, extra ?? "");
    } else {
      console.log("[rtc]", JSON.stringify(a ?? {}));
    }
  } catch {}
}

export const logJson = (obj: Any) => { try { console.log("[rtc]", JSON.stringify(obj)); } catch {} };
export default logRTC;
