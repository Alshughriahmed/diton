// src/lib/effects/core.ts
// Lightweight effects pipeline for beauty filter + 2D masks.
// No external deps. Browser-only. Safe to import from client components.

const FPS = 30;

// ---------- module state ----------
let running = false;
let beautyOn = false;

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

// ---------- public API ----------

/** Enable/disable beauty filter globally. */
export function setBeautyEnabled(on: boolean) {
  beautyOn = !!on;
}

/** Load or clear current overlay mask. Use filenames in /public/masks, pass name without extension. */
export async function setMask(name: string | null) {
  currentMaskName = name;
  currentMaskImg = null;
  if (!name || typeof window === "undefined") return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  // prefer png; user can add svg/webp with same stem if they want to swap here.
  img.src = `/masks/${encodeURIComponent(name)}.png`;
  try {
    await img.decode();
    currentMaskImg = img;
  } catch {
    // ignore load error; keep mask null
    currentMaskImg = null;
  }
}

/**
 * Start or rebuild the effects pipeline for the given raw stream.
 * Returns a MediaStream that mirrors the input with beauty/mask applied.
 */
export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (typeof window === "undefined") return src;

  // if already running on the same input stream, reuse
  if (running && inputStream === src && processedStream) return processedStream;

  // if running on a different input stream, stop then rebuild
  if (running && inputStream !== src) {
    await stopEffects(src).catch(() => {});
  }

  inputStream = src;

  const vTrack = src.getVideoTracks?.()[0] || null;
  const settings = (vTrack && vTrack.getSettings && vTrack.getSettings()) || {};
  const width = (settings as any).width || 640;
  const height = (settings as any).height || 480;

  // video element to read frames
  videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  (videoEl as any).srcObject = src;
  try {
    await videoEl.play();
  } catch {
    // continue; frames may start later
  }

  // canvas to draw + capture
  canvasEl = document.createElement("canvas");
  canvasEl.width = width;
  canvasEl.height = height;
  ctx = canvasEl.getContext("2d", { willReadFrequently: false });

  // optional face detector
  try {
    const FD: any = (globalThis as any).FaceDetector;
    if (FD) {
      faceDetector = new FD({ fastMode: true, maxDetectedFaces: 1 });
    } else {
      faceDetector = null;
    }
  } catch {
    faceDetector = null;
  }

  // capture output stream
  const cap = (canvasEl as any).captureStream ? (canvasEl as any).captureStream(FPS) : null;
  processedStream = (cap || src) as MediaStream;

  // carry audio track through
  try {
    const a = src.getAudioTracks?.()[0];
    if (cap && a) processedStream.addTrack(a);
  } catch {
    /* ignore */
  }

  running = true;
  frameCount = 0;
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

  // do not stop user's tracks; only clear our internals
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

  // keep currentMaskName; only image is dropped on GC when replaced

  return src || (inputStream as any) || (new MediaStream());
}

// ---------- internal ----------

function loop() {
  if (!running || !ctx || !canvasEl || !videoEl) return;

  try {
    const w = canvasEl.width;
    const h = canvasEl.height;

    // draw base frame
    ctx.save();
    ctx.filter = beautyOn ? "contrast(1.06) saturate(1.08) brightness(1.02) blur(0.5px)" : "none";
    ctx.drawImage(videoEl, 0, 0, w, h);
    ctx.restore();

    // try to update a face box every few frames
    if (faceDetector && (frameCount % 6 === 0)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const faces: any[] = awaitMaybe(faceDetector.detect(videoEl));
        if (faces && faces.length > 0) {
          const f = faces[0].boundingBox || faces[0].box || faces[0];
          const box = normalizeBox(f, w, h);
          if (box) lastFace = box;
        }
      } catch {
        /* ignore detection errors */
      }
    }

    // overlay mask if any
    if (currentMaskImg) {
      const { dx, dy, dw, dh } = maskRect(w, h, lastFace);
      try {
        ctx.drawImage(currentMaskImg, dx, dy, dw, dh);
      } catch {
        /* draw error ignore */
      }
    }

    frameCount += 1;
  } catch {
    /* ignore frame error */
  }

  rafId = requestAnimationFrame(loop);
}

function normalizeBox(b: any, w: number, h: number): FaceBox | null {
  if (!b) return null;
  let x = Number(b.x ?? b.left ?? 0);
  let y = Number(b.y ?? b.top ?? 0);
  let width = Number(b.width ?? (b.right ? Number(b.right) - x : 0) ?? 0);
  let height = Number(b.height ?? (b.bottom ? Number(b.bottom) - y : 0) ?? 0);

  if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;

  // clamp
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > w) width = Math.max(1, w - x);
  if (y + height > h) height = Math.max(1, h - y);

  return { x, y, width, height };
}

function maskRect(w: number, h: number, face: FaceBox | null) {
  if (face) {
    // scale mask relative to face
    const dw = face.width * 1.35;
    const dh = dw; // square mask
    const dx = face.x + face.width / 2 - dw / 2;
    const dy = face.y - dh * 0.15; // a bit above center to cover eyes/upper face
    return clampRect(dx, dy, dw, dh, w, h);
  }
  // fallback: center
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
  // no need to clamp size strongly; let it overflow slightly if needed
  return { dx, dy, dw, dh };
}

async function awaitMaybe<T = any>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null as any;
  }
}
