/* Canvas Effects Pipeline — Beauty + Masks (safe, no external deps) */
type MaskName = string | null;

let vEl: HTMLVideoElement | null = null;
let cEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let outStream: MediaStream | null = null;
let maskImg: HTMLImageElement | null = null;
let maskObjURL: string | null = null;
let running = false;

/* Helpers */
function readBeautyFlag(): boolean {
  try { return localStorage.getItem("ditona_beauty_on") === "1"; } catch { return false; }
}
function supportsCapture(): boolean {
  const c = document.createElement("canvas");
  return typeof (c as any).captureStream === "function";
}
function emojiDataUrl(emoji: string, size = 128): string {
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const x = c.getContext("2d")!;
  x.textAlign = "center"; x.textBaseline = "middle";
  x.font = `${Math.floor(size * 0.82)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  x.fillText(emoji, size / 2, size / 2);
  return c.toDataURL("image/png");
}
const FALLBACK_EMOJI: Record<string, string> = {
  cat: "🐱", bunny: "🐰", sunglasses: "🕶️", pixel: "🟪", star: "⭐", blurface: "🟨", guyfawkes: "🎭",
};
async function loadMaskImage(name: string): Promise<{ img: HTMLImageElement; url?: string } | null> {
  const url = `/masks/${encodeURIComponent(name)}.png`;
  try {
    const r = await fetch(url, { cache: "force-cache" });
    if (r.ok) {
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const img = new Image();
      return await new Promise((resolve) => {
        img.onload = () => resolve({ img, url: u });
        img.onerror = () => { URL.revokeObjectURL(u); resolve(null); };
        img.src = u;
      });
    }
  } catch {}
  const data = emojiDataUrl(FALLBACK_EMOJI[name] || "🎭");
  const img = new Image();
  return await new Promise((resolve) => {
    img.onload = () => resolve({ img });
    img.onerror = () => resolve(null);
    img.src = data;
  });
}
function cleanupNode(n?: HTMLElement | null) {
  try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch {}
}
function stopOutStream() {
  try { outStream?.getTracks?.().forEach((t) => { try { t.stop(); } catch {} }); } catch {}
  outStream = null;
}

/* Public API */
export async function setMask(name: MaskName): Promise<boolean> {
  if (!name) {
    if (maskObjURL) { try { URL.revokeObjectURL(maskObjURL); } catch {} maskObjURL = null; }
    maskImg = null;
    try { localStorage.setItem("ditona_mask", "none"); } catch {}
    return true;
  }
  const res = await loadMaskImage(name);
  if (!res) return false;
  if (maskObjURL) { try { URL.revokeObjectURL(maskObjURL); } catch {} maskObjURL = null; }
  maskImg = res.img; maskObjURL = res.url || null;
  try { localStorage.setItem("ditona_mask", name); } catch {}
  return true;
}

export async function startEffects(src: MediaStream): Promise<MediaStream> {
  // If already running, stop and restart on the new source.
  await stopEffects(src).catch(() => {});

  if (!supportsCapture()) return src;

  // Build hidden <video> from src
  vEl = document.createElement("video");
  vEl.muted = true; vEl.playsInline = true; vEl.autoplay = true; vEl.style.display = "none";
  (vEl as any).srcObject = src;
  try { await vEl.play(); } catch {}

  // Canvas
  const w = Math.max(320, vEl.videoWidth || 0 || 640);
  const h = Math.max(240, vEl.videoHeight || 0 || 480);
  cEl = document.createElement("canvas"); cEl.width = w; cEl.height = h; cEl.style.display = "none";
  document.body.appendChild(cEl);
  document.body.appendChild(vEl);
  ctx = cEl.getContext("2d", { alpha: true })!;
  const beauty = () => (readBeautyFlag()
    ? `brightness(1.05) contrast(1.05) saturate(1.07) blur(0.5px)`
    : "none");

  running = true;
  const tick = () => {
    if (!running || !ctx || !cEl || !vEl) return;
    try {
      ctx.clearRect(0, 0, cEl.width, cEl.height);
      ctx.filter = beauty();
      ctx.drawImage(vEl, 0, 0, cEl.width, cEl.height);
      if (maskImg) {
        const mw = cEl.width * 0.42;
        const mh = mw;
        const mx = (cEl.width - mw) / 2;
        const my = cEl.height * 0.18;
        ctx.filter = "none";
        if ((localStorage.getItem("ditona_mask") || "").toLowerCase() === "pixel") {
          // simple pixelation block in face region
          const s = 20;
          const t = document.createElement("canvas"); t.width = Math.max(1, Math.floor(mw / s)); t.height = Math.max(1, Math.floor(mh / s));
          const tx = t.getContext("2d")!;
          tx.drawImage(cEl, mx, my, mw, mh, 0, 0, t.width, t.height);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(t, 0, 0, t.width, t.height, mx, my, mw, mh);
          ctx.imageSmoothingEnabled = true;
        } else {
          ctx.drawImage(maskImg, mx, my, mw, mh);
        }
      }
    } catch {}
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const cs = (cEl as any).captureStream?.(30);
  if (!cs || !cs.getVideoTracks || !cs.getVideoTracks()[0]) {
    // Fallback: no processed track
    await stopEffects(src);
    return src;
  }
  outStream = cs as MediaStream;
  return outStream;
}

export async function stopEffects(fallbackSrc: MediaStream | null): Promise<MediaStream> {
  running = false;
  if (raf) cancelAnimationFrame(raf), raf = 0;
  stopOutStream();
  cleanupNode(vEl); cleanupNode(cEl);
  vEl = null; cEl = null; ctx = null;
  return fallbackSrc as MediaStream;
}
