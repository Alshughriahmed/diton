// src/lib/effects/core.ts
let running = false;
let v: HTMLVideoElement | null = null;
let c: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf: number | null = null;
let maskImg: HTMLImageElement | null = null;
let processed: MediaStream | null = null;

export async function setMask(name: string | null) {
  if (!name) { maskImg = null; return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `/masks/${encodeURIComponent(name)}.png`;
  try { await img.decode(); } catch {}
  maskImg = img;
}

export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (typeof document === "undefined") return src; // SSR guard
  if (running && processed) return processed;

  running = true;

  v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  (v as any).srcObject = src;
  try { await v.play(); } catch {}

  const s = (src.getVideoTracks?.()[0]?.getSettings?.() || {}) as MediaTrackSettings;
  const w = (s.width as number) || 640;
  const h = (s.height as number) || 480;

  c = document.createElement("canvas");
  c.width = w; c.height = h;
  ctx = c.getContext("2d");

  const draw = () => {
    if (!running || !ctx || !c || !v) return;
    try {
      ctx.clearRect(0, 0, w, h);
      // تنعيم بسيط وتحسين لون
      ctx.filter = "blur(0.6px) saturate(1.05) contrast(1.05)";
      ctx.drawImage(v, 0, 0, w, h);

      // رسم الماسك في المنتصف كطبقة فوقية
      if (maskImg) {
        const mw = Math.min(w, h) * 0.6, mh = mw;
        ctx.drawImage(maskImg, (w - mw) / 2, (h - mh) / 2, mw, mh);
      }
    } catch {}
    raf = requestAnimationFrame(draw);
  };
  draw();

  const fps = Math.min(30, Number(s.frameRate) || 30);
  processed = (c as any).captureStream ? (c as any).captureStream(fps) : src;

  // ضم الصوت الأصلي
  try {
    const at = src.getAudioTracks?.()[0];
    if (processed && at) processed.addTrack(at);
  } catch {}

  return processed || src;
}

export async function stopEffects(fallback?: MediaStream | null): Promise<MediaStream> {
  running = false;
  if (raf != null) cancelAnimationFrame(raf);
  raf = null;

  try {
    if (v) {
      (v as any).srcObject = null;
      v.pause?.();
    }
  } catch {}

  v = null; c = null; ctx = null; maskImg = null; processed = null;
  return fallback || null as any;
}
