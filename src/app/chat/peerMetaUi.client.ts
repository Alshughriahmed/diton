// src/app/chat/peerMetaUi.client.ts
/**
 * Idempotent DOM updater for peer metadata badges.
 * Listens to "ditona:peer-meta-ui" and writes into [data-ui] targets.
 */

if (typeof window !== "undefined" && !(window as any).__peerMetaUiMounted) {
  (window as any).__peerMetaUiMounted = 1;

  const apply = (meta: any) => {
    try {
      const g = document.querySelector('[data-ui="peer-gender"]') as HTMLElement | null;
      const ctry = document.querySelector('[data-ui="peer-country"]') as HTMLElement | null;
      const cty = document.querySelector('[data-ui="peer-city"]') as HTMLElement | null;

      if (g) g.textContent = meta?.gender ? String(meta.gender) : "—";
      if (ctry) ctry.textContent = meta?.country ? String(meta.country) : "—";
      if (cty) cty.textContent = meta?.city ? String(meta.city) : "";
    } catch {}
  };

  const onUI = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    apply(detail);
  };

  window.addEventListener("ditona:peer-meta-ui", onUI as any);

  // Cleanup on pagehide
  window.addEventListener(
    "pagehide",
    () => {
      try {
        window.removeEventListener("ditona:peer-meta-ui", onUI as any);
      } catch {}
    },
    { once: true }
  );
}

export {};
