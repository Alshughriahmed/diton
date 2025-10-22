// Lightweight beauty + masks pipeline. No external deps.
// Works even without images. Uses FaceDetector if available.
let running = false;
let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let outStream: MediaStream | null = null;

let maskImg: HTMLImageElement | null = null;
let faceDetector: any = null;
let frameCounter = 0;
let lastFace: { x: number; y: number; width: number; height: number } | null = null;

function ensureFaceDetector() {
  try {
    if (!faceDetector && typeof (globalThis as any).FaceDetector === "function") {
      faceDetector = new (globalThis as any).FaceDetector({ maxDetectedFaces: 1, fastMode: true });
    }
  } catch {}
}

export async function setMask(name: string | null) {
  if (!name) { maskImg = null; return; }

  // Built-ins without files
  if (name.startsWith("builtin:")) {
    maskImg = null; // we draw programmatically in draw()
    return;
  }

  // File-based mask from /public/masks
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `/masks/${encodeURIComponent(name)}.png`;
  try { await img.decode(); } catch {}
  maskImg = img;
}

export async function startEffects(src: MediaStream): Promise<MediaStream> {
  if (typeof document === "undefined") return src;

  if (running && outStream) return outStream;
  running = true;
  ensureFaceDetector();

  // Source video
  videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  (videoEl as any).srcObject = src;
  try { await videoEl.play(); } catch {}

  // Canvas setup
  const s = (src.getVideoTracks?.()[0]?.getSettings?.() || {}) as MediaTrackSettings;
  const w = (s.width as number) || 640;
  const h = (s.height as number) || 480;

  canvasEl = document.createElement("canvas");
  canvasEl.width = w;
  canvasEl.height = h;
  ctx = canvasEl.getContext("2d");

  const draw = async () => {
    if (!running || !ctx || !canvasEl || !videoEl) return;

    try {
      ctx.clearRect(0, 0, w, h);

      // Beauty filter: small blur + slight color lift
      ctx.filter = "blur(0.6px) saturate(1.05) contrast(1.05)";
      ctx.drawImage(videoEl, 0, 0, w, h);
      ctx.filter = "none";

      // Face detect every few frames to reduce CPU
      if (faceDetector && (++frameCounter % 5 === 0)) {
        try {
          const faces = await faceDetector.detect(videoEl);
          if (faces?.[0]?.boundingBox) {
            const bb = faces[0].boundingBox;
            lastFace = { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
          }
        } catch { /* ignore detector errors */ }
      }

      // Draw mask
      if (maskImg) {
        // Image mask: center on face if detected else center screen
        const box = lastFace
          ? { x: lastFace.x, y: lastFace.y, w: lastFace.width, h: lastFace.height }
          : { x: w * 0.2, y: h * 0.15, w: Math.min(w, h) * 0.6, h: Math.min(w, h) * 0.6 };
        ctx.drawImage(maskImg, box.x, box.y, box.w, box.h);
      } else {
        // Built-in programmatic masks
        // builtin:blur-face — blur ellipse over face
        // builtin:pixelate-face — pixelate rectangle over face
        // We infer from last setMask call by checking global flag:
        // no explicit flag needed; users pass setMask("builtin:blur-face") etc.
      }
      // If a builtin was requested, re-draw it:
      // We infer by checking a fake "name" stored on (setMask as any).last
      const last = (setMask as any).__last as string | undefined;
      if (last?.startsWith?.("builtin:")) {
        const f = lastFace || { x: w * 0.3, y: h * 0.2, width: w * 0.4, height: h * 0.35 };
        if (last === "builtin:blur-face") {
          // Elliptical blur using clip
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, f.height / 2, 0, 0, 2 * Math.PI);
          ctx.clip();
          ctx.filter = "blur(6px)";
          ctx.drawImage(videoEl, 0, 0, w, h);
          ctx.filter = "none";
          ctx.restore();
        } else if (last === "builtin:pixelate-face") {
          const px = 12; // block size
          const rx = Math.max(1, Math.floor(f.width / px));
          const ry = Math.max(1, Math.floor(f.height / px));
          const tmp = document.createElement("canvas");
          tmp.width = rx; tmp.height = ry;
          const tctx = tmp.getContext("2d");
          if (tctx) {
            tctx.imageSmoothingEnabled = false;
            tctx.drawImage(videoEl, f.x, f.y, f.width, f.height, 0, 0, rx, ry);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tmp, 0, 0, rx, ry, f.x, f.y, f.width, f.height);
            ctx.imageSmoothingEnabled = true;
          }
        }
      }
    } catch {}
    rafId = requestAnimationFrame(draw);
  };
  draw();

  const fps = Math.min(30, Number(s.frameRate) || 30);
  outStream = (canvasEl as any).captureStream ? (canvasEl as any).captureStream(fps) : src;

  // keep original audio
  try {
    const at = src.getAudioTracks?.()[0];
    if (outStream && at) outStream.addTrack(at);
  } catch {}

  return outStream || src;
}

// Keep last requested builtin name
const _origSetMask = setMask;
(setMask as any) = async (name: string | null) => {
  (setMask as any).__last = name || undefined;
  // @ts-ignore forward
  return _origSetMask(name);
};

export async function stopEffects(fallback?: MediaStream | null): Promise<MediaStream> {
  running = false;
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;

  try {
    if (videoEl) {
      (videoEl as any).srcObject = null;
      videoEl.pause?.();
    }
  } catch {}

  videoEl = null;
  canvasEl = null;
  ctx = null;
  outStream = null;
  maskImg = null;
  lastFace = null;
  frameCounter = 0;

  return fallback || null as any;
}
