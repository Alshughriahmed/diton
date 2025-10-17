"use client";

export type NextPrevApi = {
  next: () => void;
  prev: () => void;
  tryPrevOrRandom: () => void;
};

function emitBoth(a: string, b: string) {
  try { window.dispatchEvent(new CustomEvent(a)); } catch {}
  try { window.dispatchEvent(new CustomEvent(b)); } catch {}
}

export function useNextPrev(): NextPrevApi {
  const next = () => emitBoth("ui:next", "ditona:next");
  const prev = () => emitBoth("ui:prev", "ditona:prev");
  const tryPrevOrRandom = () => { prev(); };
  return { next, prev, tryPrevOrRandom };
}
export default useNextPrev;
