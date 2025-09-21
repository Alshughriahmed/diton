"use client";
declare global { interface Window { __DITONA_FFA?: 0|1|boolean|string } }
export function isFFA(): boolean {
  try { const v=(globalThis as any)?.window?.__DITONA_FFA; return v===1||v==="1"||v===true||v==="true"; }
  catch { return false; }
}
