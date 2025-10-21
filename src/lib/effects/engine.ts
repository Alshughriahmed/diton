// src/lib/effects/engine.ts
// Minimal realtime effects engine: beauty softening + face masks.
// Uses Canvas2D filters. Falls back gracefully if FaceDetector is unavailable.

let running = false;
let rafId = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let videoEl: HTMLVideoElement | null = null;
let outStream: MediaStream | null = null;

type MaskKind = "none" | "blur" | "pixel" | "emoji1" | "emoji2" | "emoji3";
let beautyOn = false;
let maskKind: MaskKind = "none";

let faceDetector: any = null as any;
let lastFace: { x: number; y: number; width: number; height: number } | null = null;
let faceSampleEvery = 6; // detect every N frames
let frameCount = 0;

function ensureIO(src: MediaStream) {
  if (!videoEl) {
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.srcObject = src;
    void videoEl.play().catch(() => {});
  } else if (videoEl.srcObject !== src) {
    videoEl.srcObject = src;
  }
  if (!canvas) canvas = document.createElement("canvas");
  if (!ctx) ctx = canvas.getContext("2d", { alpha: false })!;
}

function capture(): MediaStream {
  return (canvas as HTMLCanvasElement).captureStream(30);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

async function detectFace() {
  try {
    if (!faceDetector && "FaceDetector" in (window as any)) {
      faceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }
    if (!faceDetector || !videoEl) return;

    const w = videoEl.videoWidth || 0, h = videoEl.videoHeight || 0;
    if (!w || !h) return;

    // Draw small downscaled frame for quicker detect
    const tmp = canvas!;
    const s = 320; // small side
    tmp.width = s;
    tmp.height = Math.round((h / w) * s);
    ctx!.drawImage(videoEl, 0, 0, tmp.width, tmp.height);

    const faces = await faceDetector.detect(tmp);
    if (faces && faces[0] && faces[0].boundingBox) {
      const bb = faces[0].boundingBox as DOMRectReadOnly;
      // map back to full frame
      const scale = w / tmp.width;
      const x = Math.max(0, bb.x * scale);
      const y = Math.max(0, bb.y * scale);
      const ww = Math.min(w, bb.width * scale);
      const hh = Math.min(h, bb.height * scale);
      // smooth movement
      if (!lastFace) lastFace = { x, y, width: ww, height: hh };
      else {
        lastFace = {
          x: lerp(lastFace.x, x, 0.4),
          y: lerp(lastFace.y, y, 0.4),
          width: lerp(lastFace.width, ww, 0.4),
          height: lerp(lastFace.height, hh, 0.4),
        };
      }
    }
  } catch {
    // ignore detection errors
  }
}

function draw() {
  if (!running || !videoEl || !ctx || !canvas) return;
  rafId = requestAnimationFrame(draw);

  const vw = videoEl.videoWidth || 0;
  const vh = videoEl.videoHeight || 0;
  if (!vw || !vh) return;

  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw; canvas.height = vh;
  }

  // Base pass
  ctx.filter = beautyOn ? "blur(1.2px) contrast(1.05) saturate(1.06) brightness(1.02)" : "none";
  ctx.drawImage(videoEl, 0, 0, vw, vh);

  // Masking
  if (maskKind !== "none") {
    // update face box occasionally
    frameCount++;
    if (frameCount % faceSampleEvery === 0) detectFace();

    const f = lastFace ?? {
      // fallback center box if no detector
      x: vw * 0.32, y: vh * 0.22, width: vw * 0.36, height: vh * 0.46,
    };

    if (maskKind === "blur" || maskKind === "pixel") {
      ctx.save();
      // clip to face rect with rounded edges
      const r = Math.min(f.width, f.height) * 0.18;
      roundRect(ctx, f.x, f.y, f.width, f.height, r);
      ctx.clip();

      if (maskKind === "blur") {
        ctx.filter = "blur(6px)";
        ctx.drawImage(videoEl, 0, 0, vw, vh);
      } else {
        // pixelate
        const sx = Math.max(1, Math.floor(f.width / 18));
        const sy = Math.max(1, Math.floor(f.height / 18));
        const tmp = document.createElement("canvas");
        tmp.width = sx; tmp.height = sy;
        const tctx = tmp.getContext("2d")!;
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(videoEl, f.x, f.y, f.width, f.height, 0, 0, sx, sy);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, sx, sy, f.x, f.y, f.width, f.height);
      }
      ctx.restore();
    } else {
      // emoji overlay
      ctx.save();
      const cx = f.x + f.width / 2;
      const cy = f.y + f.height / 2;
      const size = Math.min(f.width, f.height) * 0.9;
      ctx.font = `${Math.floor(size)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const emoji =
        maskKind === "emoji1" ? "😎" :
        maskKind === "emoji2" ? "😶" : "🐱";
      ctx.fillText(emoji, cx, cy);
      ctx.restore();
    }
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function effectsStart(src: MediaStream) {
  ensureIO(src);
  if (!outStream) outStream = capture();
  if (!running) {
    running = true;
    draw();
  }
  return outStream!;
}

export function effectsStop() {
  running = false;
  cancelAnimationFrame(rafId);
  if (outStream) {
    try { outStream.getTracks().forEach(t => t.stop()); } catch {}
  }
  outStream = null;
  lastFace = null;
}

export function effectsSetBeauty(enabled: boolean) {
  beautyOn = !!enabled;
}

export function effectsSetMask(kind: MaskKind) {
  maskKind = kind;
}

export function effectsActive(): boolean {
  return beautyOn || maskKind !== "none";
}

export function effectsGetStream(): MediaStream | null {
  return outStream;
}
