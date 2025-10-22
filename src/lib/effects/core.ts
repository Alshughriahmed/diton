// src/lib/effects/core.ts
// تأثيرات فيديو محلية: تنعيم + ماسكات (SVG/PNG) مع FaceDetector اختياري

/* eslint-disable @typescript-eslint/no-explicit-any */

let running = false;
let rafId: number | null = null;

let videoEl: HTMLVideoElement | null = null;
let outCanvas: HTMLCanvasElement | null = null;
let outCtx: CanvasRenderingContext2D | null = null;
let outStream: MediaStream | null = null;

let curMask: HTMLImageElement | null = null;
let curMaskName: string | null = null;

const FPS = 30;

// يفضّل SVG ثم PNG
const MASK_URLS = (name: string) => [
  `/masks/${encodeURIComponent(name)}.svg`,
  `/masks/${encodeURIComponent(name)}.png`,
];

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function ensureCanvas(w: number, h: number): void {
  if (!hasWindow()) return;
  if (!outCanvas) outCanvas = document.createElement("canvas");
  if (!outCtx) outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("2d ctx not available");
  if (outCanvas.width !== w || outCanvas.height !== h) {
    outCanvas.width = w;
    outCanvas.height = h;
  }
}

function getTrackSize(src: MediaStream): { w: number; h: number } {
  const vt = src.getVideoTracks?.()[0];
  const s = vt?.getSettings?.() || {};
  const w = (s.width as number) || 640;
  const h = (s.height as number) || 480;
  return { w, h };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// FaceDetector اختياري
async function detectFaceBox(v: HTMLVideoElement): Promise<{ x: number; y: number; w: number; h: number } | null> {
  try {
    const FD: any = (window as any).FaceDetector;
    if (!FD) return null;
    const fd = new FD({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await fd.detect(v);
    const f = faces?.[0]?.boundingBox;
    if (!f) return null;
    return { x: f.x, y: f.y, w: f.width, h: f.height };
  } catch {
    return null;
  }
}

function drawMaskAt(
  ctx: CanvasRenderingContext2D,
  mask: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number },
  canvasW: number,
  canvasH: number,
) {
  const scale = 1.25; // يغطي كامل الوجه
  const mw = box.w * scale;
  const mh = box.h * scale;
  const mx = box.x + box.w / 2 - mw / 2;
  const my = box.y + box.h / 2 - mh / 2;
  // حدود آمنة
  const x = Math.max(-mw * 0.2, Math.min(mx, canvasW));
  const y = Math.max(-mh * 0.2, Math.min(my, canvasH));
  ctx.drawImage(mask, x, y, mw, mh);
}

// قوة التنعيم الأساسية
function applyBeauty(ctx: CanvasRenderingContext2D) {
  // مزيج بسيط: blur + contrast + saturate
  // يمكن رفع القيم لاحقًا
  ctx.filter = "blur(1.2px) contrast(1.06) saturate(1.05) brightness(1.02)";
}

export async function setMask(name: string | null): Promise<void> {
  curMask = null;
  curMaskName = null;
  if (!name) return;

  for (const u of MASK_URLS(name)) {
    try {
      const img = await loadImage(u);
      curMask = img;
      curMaskName = name;
      break;
    } catch {
      /* try next */
    }
  }
}

function stopLoop() {
  running = false;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
}

export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (!hasWindow()) return src;

  // تجهير فيديو الإدخال
  if (!videoEl) {
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
  }

  try {
    // @ts-ignore srcObject مدعوم في المتصفحات الحديثة
    videoEl.srcObject = src;
    await videoEl.play().catch(() => {});
  } catch {}

  const { w, h } = getTrackSize(src);
  ensureCanvas(w, h);

  // outStream عبر captureStream
  if (!outCanvas) throw new Error("canvas missing");
  outStream =
    "captureStream" in (outCanvas as any)
      ? (outCanvas as any).captureStream(FPS)
      : (src as MediaStream);

  // الصّوت
  try {
    const at = src.getAudioTracks?.()[0];
    if (at && outStream && outStream.getAudioTracks().length === 0) outStream.addTrack(at);
  } catch {}

  running = true;

  // حلقة الرسم
  const loop = async () => {
    if (!running || !outCtx || !outCanvas || !videoEl) return;

    // إطار الفيديو
    outCtx.save();
    applyBeauty(outCtx);
    outCtx.drawImage(videoEl, 0, 0, outCanvas.width, outCanvas.height);
    outCtx.restore();

    // الماسك
    if (curMask) {
      // جرّب FaceDetector ثم اسقط إلى وسط الإطار
      let box = await detectFaceBox(videoEl).catch(() => null);
      if (!box) {
        const cw = outCanvas.width;
        const ch = outCanvas.height;
        const s = Math.min(cw, ch) * 0.55;
        box = { x: cw / 2 - s / 2, y: ch / 2 - s / 2, w: s, h: s };
      }
      drawMaskAt(outCtx, curMask, box, outCanvas.width, outCanvas.height);
    }

    rafId = requestAnimationFrame(loop);
  };

  stopLoop();
  rafId = requestAnimationFrame(loop);
  running = true;

  return outStream || src;
}

export async function stopEffects(fallback?: MediaStream | null): Promise<MediaStream> {
  stopLoop();
  if (videoEl) {
    try {
      // @ts-ignore
      videoEl.srcObject = null;
    } catch {}
  }
  outCtx = null;
  outCanvas = null;

  const out = fallback || null;
  outStream = null;
  return out || (new MediaStream() as MediaStream);
}
