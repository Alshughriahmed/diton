// Robust region code provider without external deps.
// Produces full ISO-3166-1 alpha-2 set supported by the runtime.

export function getRegionCodes(): string[] {
  // 1) Prefer native list if available
  try {
    const anyIntl: any = Intl as any;
    if (typeof anyIntl.supportedValuesOf === "function") {
      const arr = anyIntl.supportedValuesOf("region") as string[];
      return Array.from(
        new Set(arr.filter((c) => /^[A-Z]{2}$/.test(c)))
      ).sort();
    }
  } catch {}

  // 2) Portable fallback: probe all AA..ZZ using DisplayNames
  try {
    const disp = new Intl.DisplayNames(["en"], { type: "region" });
    const out: string[] = [];
    for (let i = 65; i <= 90; i++) {
      for (let j = 65; j <= 90; j++) {
        const code = String.fromCharCode(i) + String.fromCharCode(j);
        // If valid, DisplayNames returns a localized name different from the code itself
        const name = disp.of(code as any);
        if (name && name !== code) out.push(code);
      }
    }
    return Array.from(new Set(out)).sort();
  } catch {}

  // 3) Minimal safe fallback
  return [
    "US","GB","CA","AU","DE","FR","IT","ES","BR","MX","TR","SA","AE","IN","PK","BD",
    "RU","UA","CN","JP","KR","ID","PH","NG","EG","MA","TN"
  ];
}
