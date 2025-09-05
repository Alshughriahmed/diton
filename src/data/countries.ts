import countries from "world-countries";

export type Country = { code: string; name: string; flag?: string };

export const COUNTRIES: Country[] = countries.map((c: any) => ({ 
  code: c.cca2, 
  name: c.name?.common || "",
  flag: c.flag || ""
}))
  .filter(c => c.code && c.name)
  .sort((a,b)=> a.name.localeCompare(b.name));

export const ALL_COUNTRIES_OPTION: Country = { code: "ALL", name: "All Countries", flag: "🌍" };
