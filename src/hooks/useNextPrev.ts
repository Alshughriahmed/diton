"use client";

export type NextPrevApi = {
  next: () => void;
  prev: () => void;
  tryPrevOrRandom: () => void;
};

function emit(name: string) {
  try { window.dispatchEvent(new CustomEvent(name)); } catch {}
}

export function useNextPrev(): NextPrevApi {
  const next = () => emit("ditona:next");
  const prev = () => emit("ditona:prev");
  const tryPrevOrRandom = () => { prev(); };
  return { next, prev, tryPrevOrRandom };
}
export default useNextPrev;
