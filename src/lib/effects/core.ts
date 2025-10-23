// src/lib/effects/core.ts
// Lightweight Canvas-2D effects: Beauty + 2D Masks.
// لا يعتمد على WebGL أو مكتبات خارجية. يعمل في المتصفح فقط.

const FPS = 30;

// ---------- module state ----------
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

// face detect (optional)
type FaceBox = { x: number; y: number; width: number; height: number };
let faceDetector: any = null;
let lastFace: FaceBox | null = null;
let frameCount = 0;

// rVFC fallback
const rVFC: (cb: FrameRequestCallback) => number =
  (typeof (globalThis as any).requestVideoFrameCallback === "function"
    ? (globalThis as any).requestVideoFrameCallback.bind(globalThis)
    : (cb: FrameRequestCallback) => requestAnimationFrame(cb)) as any;

// ---------- persisted defaults (browser only) ----------
try {
  if (typeof window !== "undefined") {
    const lv = Number(localStorage.getItem("ditona_beauty_level") || "40");
    if (Number.isFinite(lv)) beautyLevel = clamp(0, 100, Math.round(lv));
    beautyOn = localStorage.getItem("ditona_beauty_on") === "1";
  }
} catch {
  /* ignore */
}

// ---------- public API ----------

/** Enable/disable beauty filter globally. */
export function setBeautyEnabled(on: boolean) {
  beautyOn = !!on;
}

/** Optional: update beauty strength 0..100 and persist. */
export function setBeautyLevel(level: number) {
  beautyLevel = clamp(0, 100, Math.round(level));
  try {
    localStorage.setItem("ditona_beauty_level", String(beautyLevel));
  } catch {
    /* ignore */
  }
}

/** Load or clear current overlay mask. Use filenames in /public/masks, pass name without extension. */
export async function setMask(name: string | null) {
  currentMaskName = name;
  currentMaskImg = null;
  if (!name || typeof window === "undefined") return;

  // جرّب الامتدادات المتاحة لتفادي 404
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
      /* جرّب الامتداد التالي */
    }
  }
}

/**
 * Start or rebuild the effects pipeline for the given raw stream.
 * Returns a MediaStream that mirrors the input with beauty/mask applied.
 * لا يوقف getUserMedia ولا يطلب صلاحيات جديدة.
 */
export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (typeof window === "undefined") return src;

  // نفس المصدر وقيد التشغيل
  if (running && inputStream === src && processedStream) return processedStream;

  // مصدر مختلف: أوقف القديمة ثم أبنِ من جديد
  if (running && inputStream && inputStream !== src) {
    await stopEffects(inputStream).catch(() => {});
  }

  inputStream = src;

  // أبعاد أولية من إعدادات المسار
  const vTrack = src.getVideoTracks?.()[0] || null;
  const settings = (vTrack && vTrack.getSettings && vTrack.getSettings()) || {};
  let width = numberOr(settings.width, 640);
  let height = numberOr(settings.height, 480);

  // عنصر فيديو لقراءة الإطارات
  videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  (videoEl as any).srcObject = src;
  try {
    await videoEl.play();
  } catch {
    /* قد يبدأ بعد قليل */
  }

  // إن توفرت أبعاد ميتاداتا استخدمها
  if (videoEl.videoWidth && videoEl.videoHeight) {
    width = videoEl.videoWidth;
    height = videoEl.videoHeight;
  }

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

  // مسار ناتج من captureStream
  let cap: MediaStream | null = null;
  try {
    cap = (canvasEl as any).captureStream ? (canvasEl as any).captureStream(FPS) : null;
  } catch {
    cap = null;
  }
  processedStream = (cap || src) as MediaStream;

  // انقل الصوت كما هو
  try {
    const a = src.getAudioTracks?.()[0];
    if (cap && a && !processedStream.getAudioTracks().length) processedStream.addTrack(a);
  } catch {
    /* ignore */
  }

  running = true;
  frameCount = 0;

  // أوقف/استأنف على visibility
  try {
    document.addEventListener("visibilitychange", onVisibility, { passive: true });
  } catch {
    /* ignore */
  }

  loop();
  return processedStream!;
}

/** Stop effects and release internal resources. Returns a stream to continue using (usually the raw `src`). */
export async function stopEffects(src?: MediaStream): Promise<MediaStream> {
  running = false;

  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  try {
    document.removeEventListener("visibilitychange", onVisibility as any);
  } catch {
    /* ignore */
  }

  // لا نوقف Tracks للمستخدم
  try {
    if (videoEl) {
      (videoEl as any).srcObject = null;
      videoEl.pause?.();
    }
  } catch {
    /* ignore */
  }

  videoEl = null;
  ctx = null;
  canvasEl = null;

  processedStream = null;
  inputStream = null;

  // نحافظ على currentMaskName؛ الصورة تتخلّص منها GC عند الاستبدال
  return src || new MediaStream();
}

// ---------- internal helpers ----------

function onVisibility() {
  // لا نغيّر حالة التشغيل. فقط نخفّض عبء الكشف عند الإخفاء.
  // حل بسيط: أعد ضبط عدّاد الإطارات ليُبطئ الكشف فور العودة.
  frameCount = 0;
}

function loop() {
  if (!running || !ctx || !canvasEl || !videoEl) return;

  try {
    const w = canvasEl.width;
    const h = canvasEl.height;

    // قد تتغير أبعاد الفيديو بعد بدء التشغيل
    if (videoEl.videoWidth && videoEl.videoHeight && (videoEl.videoWidth !== w || videoEl.videoHeight !== h)) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }

    // ارسم الإطار الأساسي مع فلتر التجميل إن كان مفعّلًا
    ctx.save();
    ctx.filter = beautyOn ? cssFilterFromLevel(beautyLevel) : "none";
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    ctx.restore();

    // كشف وجه كل 6 إطارات إن توفر FD
    if (faceDetector && (frameCount % 6 === 0)) {
      (async () => {
        const faces = await awaitMaybe<any[]>(faceDetector.detect(videoEl!));
        if (faces && faces.length > 0) {
          const f = (faces[0] as any).boundingBox || (faces[0] as any).box || faces[0];
          const box = normalizeBox(f, canvasEl!.width, canvasEl!.height);
          if (box) lastFace = lerpBox(lastFace, box, 0.35); // تنعيم بسيط
        }
      })();
    }

    // قناع إن وُجد
    if (currentMaskImg) {
      const { dx, dy, dw, dh } = maskRect(canvasEl.width, canvasEl.height, lastFace);
      try {
        ctx.drawImage(currentMaskImg, dx, dy, dw, dh);
      } catch {
        /* ignore */
      }
    }

    frameCount += 1;
  } catch {
    /* frame error ignore */
  }

  rafId = requestAnimationFrame(loop);
}

function cssFilterFromLevel(level: number): string {
  // خريطة خطية بسيطة. مستوى 40% تقريبًا افتراضي.
  const t = clamp(0, 100, level) / 100;
  const contrast = 1 + 0.08 * t;     // حتى +8%
  const saturate = 1 + 0.12 * t;     // حتى +12%
  const brightness = 1 + 0.06 * t;   // حتى +6%
  const blurPx = 0.5 * t;            // حتى 0.5px
  return `contrast(${to3(contrast)}) saturate(${to3(saturate)}) brightness(${to3(brightness)}) blur(${to3(blurPx)}px)`;
}

function normalizeBox(b: any, w: number, h: number): FaceBox | null {
  if (!b) return null;

  let x = Number(b.x !== undefined ? b.x : b.left !== undefined ? b.left : 0);
  let y = Number(b.y !== undefined ? b.y : b.top !== undefined ? b.top : 0);

  let width = Number(
    b.width !== undefined
      ? b.width
      : b.right !== undefined
      ? Number(b.right) - x
      : 0
  );

  let height = Number(
    b.height !== undefined
      ? b.height
      : b.bottom !== undefined
      ? Number(b.bottom) - y
      : 0
  );

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
    // مقياس بسيط فوق الوجه
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
  let dx = x, dy = y, dw = w, dh = h;
  if (dx < -dw) dx = -dw;
  if (dy < -dh) dy = -dh;
  if (dx > bw) dx = bw;
  if (dy > bh) dy = bh;
  return { dx, dy, dw, dh };
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
