type Detail = any;
const w: any = (typeof window !== "undefined") ? window : null;

export function busEmit(name: string, detail?: Detail) {
  if (!w) return;
  w.dispatchEvent(new CustomEvent(name, { detail }));
}

export function busOn(name: string, handler: (d?: Detail) => void) {
  if (!w) return () => {};
  const fn = (ev: Event) => handler((ev as CustomEvent).detail);
  w.addEventListener(name, fn as any);
  return () => w.removeEventListener(name, fn as any);
}

// default for convenience
export default { busEmit, busOn };
