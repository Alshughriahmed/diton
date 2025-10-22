// src/lib/effects/core.ts
// Canvas-based pipeline: beauty + optional PNG mask overlay.
// No external deps. Keeps audio, never stops camera.

let running = false;
let rafId: number | null = null;

let srcStream: MediaStream | null = null;
let outStream: MediaStream | null = null;

let videoEl: HTMLVideoElement | null = null;
let drawCanvas: HTMLCanvasElement | null = null;   // work canvas (processing)
let outCanvas: HTMLCanvasElement | null = null;    // canvas used for captureStream()

let maskImg: HTMLImageElement | null = null;
let maskName: string | null = null;

let faceDetector: any = null;
let detectPending = false;
let lastBox: { x: number; y: number; width: number; height: number } | null = null;
let lastDetectTs = 0;

const MASK_BASE = "/masks";
const FPS = 30;
const DETECT_EVERY_MS = 160; // ~6 fps face detect
const SMOOTH = 0.25;         // bbox smoothing

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function ensureElems(w: number, h: number) {
  if (!drawCanvas) {
    drawCanvas = document.createElement("canvas");
  }
  if (!outCanvas) {
    outCanvas = document.createElement("canvas");
  }
  if (!videoEl) {
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
  }
  // normalize sizes
  if (drawCanvas.width !== w || drawCanvas.height !== h) {
    drawCanvas.width = w; drawCanvas.height = h;
  }
  if (outCanvas.width !== w || outCanvas.height !== h) {
    outCanvas.width = w; outCanvas.height = h;
  }
}

async function maybeInitFaceDetector() {
  try {
    if (!faceDetector && typeof window !== "undefined" && (window as any).FaceDetector) {
      // @ts-ignore - FaceDetector is not in TS DOM by default on all targets
      faceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }
  } catch {
    faceDetector = null;
  }
}

function drawFrame() {
  if (!running || !videoEl || !drawCanvas || !outCanvas) return;

  const ctx = drawCanvas.getContext("2d");
  const ctxOut = outCanvas.getContext("2d");
  if (!ctx || !ctxOut) { rafId = requestAnimationFrame(drawFrame); return; }

  // Beauty pass
  try {
    ctx.filter = "contrast(1.08) saturate(1.08) brightness(1.03) blur(0.4px)";
    ctx.drawImage(videoEl, 0, 0, drawCanvas.width, drawCanvas.height);
  } catch {}

  // Kick async face-detect at a limited rate
  const now = performance.now();
  if (faceDetector && !detectPending && now - lastDetectTs > DETECT_EVERY_MS) {
    detectPending = true;
    lastDetectTs = now;
    faceDetector.detect(videoEl)
      .then((faces: any[]) => {
        const f = faces && faces[0];
        if (f?.boundingBox) {
          const b = f.boundingBox as DOMRectReadOnly;
          if (lastBox) {
            lastBox = {
              x: lerp(lastBox.x, b.x, SMOOTH),
              y: lerp(lastBox.y, b.y, SMOOTH),
              width: lerp(lastBox.width, b.width, SMOOTH),
              height: lerp(lastBox.height, b.height, SMOOTH),
            };
          } else {
            lastBox = { x: b.x, y: b.y, width: b.width, height: b.height };
          }
        }
      })
      .catch(() => {})
      .finally(() => { detectPending = false; });
  }

  // Mask overlay
  if (maskImg) {
    const W = drawCanvas.width, H = drawCanvas.height;
    let x = W * 0.5, y = H * 0.5, mw = Math.min(W, H) * 0.6, mh = mw;

    if (lastBox) {
      const s = 1.45; // enlarge a bit beyond face
      mw = lastBox.width * s;
      mh = mw;
      x = lastBox.x + lastBox.width / 2;
      y = lastBox.y + lastBox.height * 0.45; // shift slightly upward relative to center
      x -= mw / 2;
      y -= mh / 2;
    } else {
      // fallback: center overlay if detector not available
      x -= mw / 2; y -= mh / 2;
    }

    try {
      ctx.drawImage(maskImg, x, y, mw, mh);
    } catch {}
  }

  // Copy to out-canvas (separate canvas yields stable captureStream on all browsers)
  try {
    ctxOut.clearRect(0, 0, outCanvas.width, outCanvas.height);
    ctxOut.drawImage(drawCanvas, 0, 0);
  } catch {}

  rafId = requestAnimationFrame(drawFrame);
}

export async function setMask(name: string | null): Promise<void> {
  maskName = name || null;
  maskImg = null;
  if (!maskName) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.loading = "eager";
  img.src = `${MASK_BASE}/${encodeURIComponent(maskName)}.png`;

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });

  // If failed to load, keep mask off silently
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    maskImg = img;
  } else {
    maskName = null;
    maskImg = null;
  }
}

export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (running && outStream) return outStream;

  await maybeInitFaceDetector();

  srcStream = src || null;
  const vt = src.getVideoTracks?.()[0];
  const set = vt?.getSettings?.() || {};
  const w = (set.width as number) || 640;
  const h = (set.height as number) || 480;

  ensureElems(w, h);

  // hook source to hidden video
  if (videoEl) {
    try { (videoEl as any).srcObject = src; } catch {}
    try { await videoEl!.play(); } catch {}
  }

    // create output stream
  try {
    const cap = (outCanvas as any).captureStream;
    if (typeof cap === "function") {
      outStream = cap.call(outCanvas, FPS) as MediaStream;
    } else {
      outStream = src as MediaStream; // fallback
    }
  } catch {
    outStream = src as MediaStream; // fallback
  }

  // add audio from src
  try {
    const at = src.getAudioTracks?.()[0];
    if (at && outStream && !outStream.getAudioTracks().length) outStream.addTrack(at);
  } catch {}

  running = true;
  rafId = requestAnimationFrame(drawFrame);
  return outStream!;
}

export async function stopEffects(fallback?: MediaStream | null): Promise<MediaStream> {
  running = false;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;

  // Do not stop camera tracks. We only release our canvas stream.
  try {
    outStream?.getVideoTracks?.().forEach((t) => {
      try { t.stop(); } catch {}
    });
  } catch {}
  outStream = null;

  // Keep elements for quick re-entry but clear face box so mask repositions
  lastBox = null;

  // Return original source if given, else the last source, else empty stream
  if (fallback) return fallback;
  if (srcStream) return srcStream;
  try {
    return new MediaStream();
  } catch {
    // Safari old fallback
    // @ts-ignore
    return (undefined as any);
  }
}
