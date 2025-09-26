import { getRegionCodes } from "./regionCodes";

export type Region = { code: string; name: string; flag: string };

const flagOf = (code: string) =>
  code.toUpperCase()
      .replace(/[^A-Z]/g,'')
      .split('')
      .map(c => String.fromCodePoint(0x1f1e6 + (c.charCodeAt(0) - 65)))
      .join('');

export function getAllRegions(): Region[] {
  // Use safe region codes helper to avoid Intl.supportedValuesOf crashes
  const supported: string[] = getRegionCodes();

  const disp = new Intl.DisplayNames(["en"], { type: "region" });

  // Filter to only 2-letter country codes
  const codes = supported.filter(c => /^[A-Z]{2}$/.test(c));

  const uniq = Array.from(new Set(codes));
  return uniq.map(code => ({
    code,
    name: disp.of(code) || code,
    flag: flagOf(code)
  })).sort((a,b)=>a.name.localeCompare(b.name));
}
