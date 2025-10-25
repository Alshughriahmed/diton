// src/lib/effects/face/landmarker.ts
// واجهة تعرّف صندوق الوجه + مُكتشف خفيف يعتمد FaceDetector إن وُجد.

export type FaceBox = { x: number; y: number; width: number; height: number };

export interface Landmarker {
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<FaceBox | null>;
  dispose(): void;
}

class FDLandmarker implements Landmarker {
  private fd: any | null = null;
  constructor() {
    try {
      const FD: any = (globalThis as any).FaceDetector;
      this.fd = FD ? new FD({ fastMode: true, maxDetectedFaces: 1 }) : null;
    } catch {
      this.fd = null;
    }
  }
  async detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<FaceBox | null> {
    if (!this.fd) return null;
    try {
      const faces = await this.fd.detect(source);
      if (!faces?.length) return null;
      const b: any = faces[0].boundingBox || faces[0].box || faces[0];
      const x = num(b.x ?? b.left ?? 0);
      const y = num(b.y ?? b.top ?? 0);
      const w = num(b.width ?? (b.right != null ? b.right - x : 0));
      const h = num(b.height ?? (b.bottom != null ? b.bottom - y : 0));
      if (!isFinite(x + y + w + h) || w <= 0 || h <= 0) return null;
      return { x, y, width: w, height: h };
    } catch {
      return null;
    }
  }
  dispose() {
    this.fd = null;
  }
}

export async function createLandmarker(): Promise<Landmarker> {
  return new FDLandmarker();
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
