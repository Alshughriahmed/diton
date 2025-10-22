// src/lib/effects/core.ts
let running = false;
let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let maskImg: HTMLImageElement | null = null;
let processed: MediaStream | null = null;

/** تحميل/تفريغ الماسك */
export async function setMask(name: string | null) {
  if (!name) { maskImg = null; return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `/masks/${encodeURIComponent(name)}.png`;
  try { await img.decode(); } catch {}
  maskImg = img;
}

/** بدء خط التجميل/الماسك وإرجاع مسار فيديو معالج */
export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (running && processed) return processed;

  running = true;

  // عناصر الرسم
  videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  // @ts-expect-error srcObject مدعوم بالمتصفح
  videoEl.srcObject = src;
  try { await videoEl.play(); } catch {}

  const vs = (src.getVideoTracks?.()[0]?.getSettings?.() || {}) as MediaTrackSettings;
  const w = (vs.width as number) || 640;
  const h = (vs.height as number) || 480;

  canvasEl = document.createElement("canvas");
  canvasEl.width = w;
  canvasEl.height = h;
  ctx = canvasEl.getContext("2d");

  const draw = () => {
    if (!running || !ctx || !canvasEl || !videoEl) return;
    try {
      // تنعيم بسيط وتحسين لون
      ctx.filter = "blur(0.6px) saturate(1.05) contrast(1.05)";
      ctx.drawImage(videoEl, 0, 0, w, h);

      // رسم الماسك (مركزيًا كقناع بسيط)
      if (maskImg) {
        const mw = Math.min(w, h) * 0.6;
        const mh = mw;
        ctx.drawImage(maskImg, (w - mw) / 2, (h - mh) / 2, mw, mh);
      }
    } catch {}
    rafId = requestAnimationFrame(draw);
  };
  draw();

  // إنتاج مسار الفيديو المعالج
  const fps = Math.min(30, (vs.frameRate as number) || 30);
  // @ts-expect-error captureStream متاح على canvas
  processed = canvasEl.captureStream ? canvasEl.captureStream(fps) : null;

  // ضم الصوت الأصلي
  try {
    const at = src.getAudioTracks?.()[0];
    if (processed && at) processed.addTrack(at);
  } catch {}

  return processed || src;
}

/** إيقاف التأثيرات والعودة للمسار الأصلي */
export async function stopEffects(fallback?: MediaStream | null): Promise<MediaStream> {
  running = false;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;

  try {
    // تنظيف
    if (videoEl) {
      // @ts-expect-error
      videoEl.srcObject = null;
      videoEl.pause?.();
    }
  } catch {}

  videoEl = null;
  canvasEl = null;
  ctx = null;
  maskImg = null;

  const out = fallback || null;
  processed = null;
  return out as MediaStream;
}
