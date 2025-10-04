type AnyRec = Record<string, any>;

export function logRTC(event: string, status: number, extra?: AnyRec): void;
export function logRTC(obj: AnyRec): void;
export function logRTC(a: any, b?: any, c?: any): void {
  try {
    if (typeof a === "string") {
      console.log(\`[rtc] \${a}\`, b ?? "", c ?? "");
    } else {
      console.log("[rtc]", JSON.stringify(a ?? {}));
    }
  } catch {}
}

export function logJson(obj: AnyRec) {
  try { console.log("[rtc]", JSON.stringify(obj)); } catch {}
}
export default logRTC;
