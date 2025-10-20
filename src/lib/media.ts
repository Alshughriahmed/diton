// src/lib/media.ts
/* Client-only media helpers for local cam/mic.
 * Exports used by ChatClient & Toolbar:
 *   initLocalMedia(), getLocalStream(), toggleMic(), toggleCam(), switchCamera()
 *   isTorchSupported(), toggleTorch(), getCurrentFacing()
 */

let localStream: MediaStream | null = null;
let currentFacing: "user" | "environment" = "user";

const FACE_KEY = "ditona_cam_face";

function loadFacing() {
  try {
    const v = String(localStorage.getItem(FACE_KEY) || "");
    if (v === "user" || v === "environment") currentFacing = v as any;
  } catch {}
}
function saveFacing() {
  try {
    localStorage.setItem(FACE_KEY, currentFacing);
  } catch {}
}

function baseVideoConstraints(face: "user" | "environment") {
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: face,
  } as MediaTrackConstraints;
}

async function getWithFacing(face: "user" | "environment"): Promise<MediaStream> {
  // 1) facingMode مباشرة
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: baseVideoConstraints(face),
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {}

  // 2) deviceId fall-back
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vids = devices.filter((d) => d.kind === "videoinput");
    const pick =
      vids.find((d) => (face === "user" ? /front|user/i.test(d.label) : /back|rear|environment/i.test(d.label))) ||
      (face === "user" ? vids[0] : vids[vids.length - 1]);
    if (!pick) throw new Error("no video device");

    return await navigator.mediaDevices.getUserMedia({
      video: { ...baseVideoConstraints(face), deviceId: { exact: pick.deviceId } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    // 3) آخر محاولة: أي كاميرا
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }
}

function replaceLocalStream(newStream: MediaStream) {
  try {
    const oldVid = localStream?.getVideoTracks?.()[0];
    if (oldVid) oldVid.stop();
  } catch {}
  localStream = newStream;
}

export function getLocalStream(): MediaStream | null {
  return localStream;
}

export async function initLocalMedia(): Promise<MediaStream> {
  loadFacing();
  const s = await getWithFacing(currentFacing);
  replaceLocalStream(s);
  return s;
}

export function toggleMic(): boolean {
  const a = localStream?.getAudioTracks?.()[0];
  if (!a) return false;
  a.enabled = !a.enabled;
  return a.enabled;
}

export function toggleCam(): boolean {
  const v = localStream?.getVideoTracks?.()[0];
  if (!v) return false;
  v.enabled = !v.enabled;
  return v.enabled;
}

/** Switch between front/back stably on iOS/Android/Desktop.
 * Returns a fresh MediaStream containing new video + existing audio if present.
 */
export async function switchCamera(): Promise<MediaStream | null> {
  currentFacing = currentFacing === "user" ? "environment" : "user";
  saveFacing();

  const oldAudio = localStream?.getAudioTracks?.()[0] || null;

  const newVidStream = await getWithFacing(currentFacing).catch(() => null);
  if (!newVidStream) return null;

  const newVideo = newVidStream.getVideoTracks()[0];
  const out = new MediaStream();

  if (newVideo) out.addTrack(newVideo);
  if (oldAudio) out.addTrack(oldAudio);

  replaceLocalStream(out);
  return out;
}

// Torch support helpers
export function getCurrentFacing(): "user" | "environment" {
  return currentFacing;
}

export function isTorchSupported(): boolean {
  try {
    const v = localStream?.getVideoTracks?.()[0] as any;
    const caps = v?.getCapabilities?.();
    return !!caps?.torch;
  } catch {
    return false;
  }
}

export async function toggleTorch(on?: boolean): Promise<boolean> {
  try {
    const v = (localStream?.getVideoTracks?.()[0] as any) || null;
    if (!v) return false;
    const caps = v.getCapabilities?.();
    if (!caps?.torch) return false;
    const cur = v.getSettings?.().torch as boolean | undefined;
    const target = typeof on === "boolean" ? on : !cur;
    await v.applyConstraints({ advanced: [{ torch: target }] });
    return true;
  } catch {
    return false;
  }
}
