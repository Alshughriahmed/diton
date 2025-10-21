export function flagEmoji(iso2: string): string {
  const cc = (iso2 || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🌐";
  return String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0)));
}
