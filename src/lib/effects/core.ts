// src/lib/effects/core.ts
// تأثيرات 2D خفيفة: Beauty + Masks على Canvas.
// متصفح فقط. لا WebGL ولا تبعيات خارجية.

let TARGET_FPS = 30;

// سقف المعالجة للأجهزة الضعيفة
const LOW_END =
  typeof navigator !== "undefined" &&
  (navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false);

let MAX_WIDTH = LOW_END ? 720 : 960;   // سقف العرض
let MIN_HEIGHT = 480;                  // لا نهبط أقل من 480p

// ---------- حالة الموديول ----------
let running = false;

let beautyOn = false;
let beautyLevel = 40; // 0..100

let inputStream: MediaStream | null = null;
let processedStream: MediaStream | null = null;

let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

let rafId: number | null = null;

// mask
let currentMaskName: string | null = null;
let currentMaskImg: HTMLImageElement | null = null;

// FaceDetector اختياري
type FaceBox = { x: number; y: number; width: number; height: number };
let faceDetector: any = null;
let lastFace: FaceBox | null = null;
let frameCount = 0;

// ---------- افتراضات محفوظة ----------
try {
  if (typeof window !== "undefined") {
    const lv = Number(localStorage.getItem("ditona_beauty_level") || "40");
    if (Number.isFinite(lv)) beautyLevel = clamp(0, 100, Math.round(lv));
    beautyOn = localStorage.getItem("ditona_beauty_on") === "1";
  }
} catch {}

// ---------- API عام ----------

/** تفعيل/تعطيل التجميل. */
export function setBeautyEnabled(on: boolean) {
  beautyOn = !!on;
}

/** قوة التجميل 0..100 مع حفظ. */
export function setBeautyLevel(level: number) {
  beautyLevel = clamp(0, 100, Math.round(level));
  try {
    localStorage.setItem("ditona_beauty_level", String(beautyLevel));
  } catch {}
}

/** سقف المعالجة اختياريًا. يعاد تطبيقه عند بدء بايبلاين جديدة. */
export function setProcessingCap(opts: { maxWidth?: number; minHeight?: number; fps?: number } = {}) {
  if (Number.isFinite(opts.maxWidth as number) && (opts.maxWidth as number) > 0) {
    MAX_WIDTH = Math.max(320, Math.round(opts.maxWidth as number));
  }
  if (Number.isFinite(opts.minHeight as number) && (opts.minHeight as number) > 0) {
    MIN_HEIGHT = Math.max(240, Math.round(opts.minHeight as number));
  }
  if (Number.isFinite(opts.fps as number) && (opts.fps as number) > 8) {
    TARGET_FPS = Math.min(60, Math.round(opts.fps as number));
  }
}

/** إرجاع الستريم المعالَج الحالي إن وُجد. */
export function getProcessedStream(): MediaStream | null {
  return processedStream || null;
}

/** هل البايبلاين تعمل. */
export function isEffectsRunning(): boolean {
  return running && !!processedStream;
}

/** تحميل أو مسح القناع. الاسم دون الامتداد. */
export async function setMask(name: string | null) {
  currentMaskName = name;
  currentMaskImg = null;
  if (!name || typeof window === "undefined") return;

  // جرّب الامتدادات الشائعة لتفادي 404
  for (const ext of ["png", "webp", "svg"]) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.loading = "eager";
    img.src = `/masks/${encodeURIComponent(name)}.${ext}`;
    try {
      await img.decode();
      currentMaskImg = img;
      break;
    } catch {
      /* جرّب التالي */
    }
  }
}

/**
 * بدء أو إعادة بناء بايبلاين التأثيرات.
 * يعيد MediaStream يطابق المصدر مع التجميل/القناع.
 */
export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (typeof window === "undefined") return src;

  if (running && inputStream === src && processedStream) return processedStream;

  if (running && inputStream && inputStream !== src) {
    await stopEffects(inputStream).catch(() => {});
  }

  inputStream = src;

  // أبعاد أولية
  const vTrack = src.getVideoTracks?.()[0] || null;
  const settings = (vTrack && vTrack.getSettings && vTrack.getSettings()) || {};
  let width = numberOr((settings as any).width, 640);
  let height = numberOr((settings as any).height, 480);

  // عنصر فيديو لقراءة الإطارات
  videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  (videoEl as any).srcObject = src;
  try {
    await videoEl.play();
  } catch {}

  // استخدم أبعاد الفيديو الفعلية إن توفرت
  if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
    width = videoEl.videoWidth;
    height = videoEl.videoHeight;
  }

  // طبّق سقف المعالجة مع الحفاظ على النسبة
  const capped = capDimensions(width, height, MAX_WIDTH, MIN_HEIGHT);
  width = capped.w;
  height = capped.h;

  // Canvas للرسم والالتقاط
  canvasEl = document.createElement("canvas");
  canvasEl.width = width;
  canvasEl.height = height;
  ctx = canvasEl.getContext("2d", { willReadFrequently: false });

  // FaceDetector اختياري
  try {
    const FD: any = (globalThis as any).FaceDetector;
    faceDetector = FD ? new FD({ fastMode: true, maxDetectedFaces: 1 }) : null;
  } catch {
    faceDetector = null;
  }

  // captureStream مع FPS مضبوط
  let cap: MediaStream | null = null;
  try {
    const capAny = (canvasEl as any).captureStream;
    cap = capAny ? capAny(TARGET_FPS) : null;
  } catch {
    cap = null;
  }
  processedStream = (cap || src) as MediaStream;

  // مرّر الصوت مرة واحدة
  try {
    const a = src.getAudioTracks?.()[0];
    if (cap && a && processedStream.getAudioTracks().length === 0) {
      processedStream.addTrack(a);
    }
  } catch {}

  running = true;
  frameCount = 0;

  try {
    document.addEventListener("visibilitychange", onVisibility, { passive: true });
  } catch {}

  loop();
  return processedStream!;
}

/** إيقاف التأثيرات وتحرير الموارد. يعيد ستريم للاستمرار. */
export async function stopEffects(src?: MediaStream): Promise<MediaStream> {
  running = false;

  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  try {
    document.removeEventListener("visibilitychange", onVisibility as any);
  } catch {}

  try {
    if (videoEl) {
      (videoEl as any).srcObject = null;
      videoEl.pause?.();
    }
  } catch {}

  videoEl = null;
  ctx = null;
  canvasEl = null;

  processedStream = null;
  inputStream = null;

  return src || new MediaStream();
}

// ---------- داخلي ----------

function onVisibility() {
  // فقط نخفّض عبء الكشف بعد العودة
  frameCount = 0;
}

function loop() {
  if (!running || !ctx || !canvasEl || !videoEl) return;

  try {
    // اضبط الأبعاد إذا تغيرت فجأة
    if (videoEl.videoWidth && videoEl.videoHeight) {
      const needResize =
        videoEl.videoWidth !== canvasEl.width || videoEl.videoHeight !== canvasEl.height;

      if (needResize) {
        const capped = capDimensions(
          videoEl.videoWidth,
          videoEl.videoHeight,
          MAX_WIDTH,
          MIN_HEIGHT
        );
        canvasEl.width = capped.w;
        canvasEl.height = capped.h;
      }
    }

    // إطار الأساس + التجميل
    ctx.save();
    ctx.filter = beautyOn ? cssFilterFromLevel(beautyLevel) : "none";
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    ctx.restore();

    // كشف وجه كل 6 إطارات إذا توفر FD
    if (faceDetector && frameCount % 6 === 0) {
      (async () => {
        const faces = await awaitMaybe<any[]>(faceDetector.detect(videoEl!));
        if (faces && faces.length > 0) {
          const f = (faces[0] as any).boundingBox || (faces[0] as any).box || faces[0];
          const box = normalizeBox(f, canvasEl!.width, canvasEl!.height);
          if (box) lastFace = lerpBox(lastFace, box, 0.35);
        }
      })();
    }

    // قناع
    if (currentMaskImg) {
      const { dx, dy, dw, dh } = maskRect(canvasEl.width, canvasEl.height, lastFace);
      try {
        ctx.drawImage(currentMaskImg, dx, dy, dw, dh);
      } catch {}
    }

    frameCount += 1;
  } catch {}

  rafId = requestAnimationFrame(loop);
}

function cssFilterFromLevel(level: number): string {
  const t = clamp(0, 100, level) / 100;
  const contrast = 1 + 0.08 * t;
  const saturate = 1 + 0.12 * t;
  const brightness = 1 + 0.06 * t;
  const blurPx = 0.5 * t;
  return `contrast(${to3(contrast)}) saturate(${to3(saturate)}) brightness(${to3(brightness)}) blur(${to3(
    blurPx
  )}px)`;
}

function normalizeBox(b: any, w: number, h: number): FaceBox | null {
  if (!b) return null;

  let x = Number(b.x !== undefined ? b.x : b.left !== undefined ? b.left : 0);
  let y = Number(b.y !== undefined ? b.y : b.top !== undefined ? b.top : 0);

  let width = Number(b.width !== undefined ? b.width : b.right !== undefined ? Number(b.right) - x : 0);
  let height = Number(b.height !== undefined ? b.height : b.bottom !== undefined ? Number(b.bottom) - y : 0);

  if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;

  // clamp
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > w) width = Math.max(1, w - x);
  if (y + height > h) height = Math.max(1, h - y);

  return { x, y, width, height };
}

function lerpBox(a: FaceBox | null, b: FaceBox, k: number): FaceBox {
  if (!a) return b;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    width: a.width + (b.width - a.width) * k,
    height: a.height + (b.height - a.height) * k,
  };
}

function maskRect(w: number, h: number, face: FaceBox | null) {
  if (face) {
    const dw = face.width * 1.35;
    const dh = dw;
    const dx = face.x + face.width / 2 - dw / 2;
    const dy = face.y - dh * 0.15;
    return clampRect(dx, dy, dw, dh, w, h);
  }
  const s = Math.min(w, h) * 0.6;
  const dx = (w - s) / 2;
  const dy = (h - s) / 2;
  return { dx, dy, dw: s, dh: s };
}

function clampRect(x: number, y: number, w: number, h: number, bw: number, bh: number) {
  let dx = x,
    dy = y,
    dw = w,
    dh = h;
  if (dx < -dw) dx = -dw;
  if (dy < -dh) dy = -dh;
  if (dx > bw) dx = bw;
  if (dy > bh) dy = bh;
  return { dx, dy, dw, dh };
}

function capDimensions(w: number, h: number, maxW: number, minH: number): { w: number; h: number } {
  // حافظ على النسبة. نخفض إذا تعدّى العرض السقف أو إذا الارتفاع أعلى من minH ونريد تقليله للأداء.
  const ratio = w / Math.max(1, h);

  let targetW = w;
  let targetH = h;

  if (w > maxW) {
    targetW = maxW;
    targetH = Math.round(maxW / ratio);
  }

  // على الأجهزة الضعيفة أو عند ارتفاع كبير، اجعل الارتفاع نحو 480p كحد تقريبي
  if (LOW_END && targetH > minH) {
    targetH = minH;
    targetW = Math.round(minH * ratio);
  }

  return { w: Math.max(1, targetW), h: Math.max(1, targetH) };
}

async function awaitMaybe<T = any>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null as any;
  }
}

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}

function numberOr(v: any, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function to3(n: number) {
  return Math.round(n * 1000) / 1000;
}
