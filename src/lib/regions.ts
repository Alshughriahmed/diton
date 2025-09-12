export type Region = { code: string; name: string; flag: string };

const flagOf = (code: string) =>
  code.toUpperCase()
      .replace(/[^A-Z]/g,'')
      .split('')
      .map(c => String.fromCodePoint(0x1f1e6 + (c.charCodeAt(0) - 65)))
      .join('');

export function getAllRegions(): Region[] {
  // متاح بالمتصفحات الحديثة
  // قد تُرجع أكواد غير دول (مثل 001) — نُرشّح 2-حرف فقط
  // نستخدم أسماء إنجليزية دائمًا
  // @ts-ignore
  const supported: string[] = (typeof Intl!=="undefined" && (Intl as any).supportedValuesOf)
    ? (Intl as any).supportedValuesOf("region") : [];

  const disp = new Intl.DisplayNames(["en"], { type: "region" });

  const codes = (supported.length ? supported : [
    // احتياطي بسيط في حال متصفح قديم
    "US","GB","DE","FR","IT","ES","CA","BR","AU","RU","CN","JP","KR","IN","SA","AE","TR","NL","SE","NO","DK","FI","PL","GR","EG","MA","TN","ZA","AR","CL","MX"
  ]).filter(c => /^[A-Z]{2}$/.test(c));

  const uniq = Array.from(new Set(codes));
  return uniq.map(code => ({
    code,
    name: disp.of(code) || code,
    flag: flagOf(code)
  })).sort((a,b)=>a.name.localeCompare(b.name));
}
