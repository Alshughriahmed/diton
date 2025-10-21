/* Client-only media helpers for local cam/mic.
 * Exports used by ChatClient & Toolbar:
 *   initLocalMedia(), getLocalStream(), toggleMic(), toggleCam()
 *   cycleCameraNext(), isTorchSupported(), toggleTorch(), getCurrentFacing(), getMicState()
 */

let localStream: MediaStream | null = null;

type Facing = "user" | "environment";
let currentFacing: Facing = "user";
const FACE_KEY = "ditona_cam_face";
const CAM_INDEX_KEY = "ditona_cam_index";

type VideoDevice = { deviceId: string; label: string };
let videoDevices: VideoDevice[] = [];
let videoIndex = 0;

function loadFacing() {
  try {
    const v = String(localStorage.getItem(FACE_KEY) || "");
    if (v === "user" || v === "environment") currentFacing = v as Facing;
  } catch {}
}
function saveFacing() {
  try {
    localStorage.setItem(FACE_KEY, currentFacing);
  } catch {}
}
function loadIndex() {
  try {
    const v = Number(localStorage.getItem(CAM_INDEX_KEY) || "0");
    if (!Number.isNaN(v)) videoIndex = Math.max(0, v);
  } catch {}
}
function saveIndex() {
  try {
    localStorage.setItem(CAM_INDEX_KEY, String(videoIndex));
  } catch {}
}

function guessFacingByLabel(label: string): Facing {
  const s = label.toLowerCase();
  if (/back|rear|environment|tele|zoom/.test(s)) return "environment";
  return "user";
}

async function refreshVideoDevices(): Promise<VideoDevice[]> {
  const devs = await navigator.mediaDevices.enumerateDevices();
  const vids = devs.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "" }));
  // ترتيب ثابت: front → back → tele (إذا وُجد)
  vids.sort((a, b) => {
    const fa = /back|rear|environment/i.test(a.label) ? 1 : 0;
    const fb = /back|rear|environment/i.test(b.label) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const ta = /tele|zoom/i.test(a.label) ? 1 : 0;
    const tb = /tele|zoom/i.test(b.label) ? 1 : 0;
    return ta - tb;
  });
  videoDevices = vids;
  if (videoIndex >= videoDevices.length) videoIndex = 0;
  saveIndex();
  return videoDevices;
}

function baseVideoConstraints() {
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  } as MediaTrackConstraints;
}

async function getWithDeviceId(deviceId?: string): Promise<MediaStream> {
  const video: MediaTrackConstraints = deviceId
    ? { ...baseVideoConstraints(), deviceId: { exact: deviceId } }
    : true;
  return await navigator.mediaDevices.getUserMedia({
    video,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
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
  loadIndex();
  await refreshVideoDevices().catch(() => {});
  const initialDevice = videoDevices[videoIndex]?.deviceId;
  const s = await getWithDeviceId(initialDevice).catch(async () => await getWithDeviceId());
  const vt = s.getVideoTracks?.()[0];
  if (vt) currentFacing = guessFacingByLabel(vt.label || videoDevices[videoIndex]?.label || "");
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

/** Cycle cameras by deviceId:
 * front → back → tele (إن وُجد) → الرجوع للبداية.
 * يعمل دون اتصال، ويعيد MediaStream جديدة تحتوي الفيديو الجديد + الصوت القديم إن وُجد.
 */
export async function cycleCameraNext(): Promise<MediaStream | null> {
  await refreshVideoDevices().catch(() => {});
  if (!videoDevices.length) return null;

  // تقدّم المؤشر
  videoIndex = (videoIndex + 1) % videoDevices.length;
  saveIndex();

  const target = videoDevices[videoIndex];
  const oldAudio = localStream?.getAudioTracks?.()[0] || null;

  const newVidStream = await getWithDeviceId(target.deviceId).catch(() => null);
  if (!newVidStream) return null;

  const newVideo = newVidStream.getVideoTracks()[0];
  const out = new MediaStream();
  if (newVideo) out.addTrack(newVideo);
  if (oldAudio) out.addTrack(oldAudio);

  currentFacing = guessFacingByLabel(newVideo?.label || target.label || "");
  saveFacing();
  replaceLocalStream(out);
  return out;
}

// Torch helpers
export function getCurrentFacing(): Facing {
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

// Mic state for accurate icon
export function getMicState(): boolean {
  try {
    const a = localStream?.getAudioTracks?.()[0];
    return !!a?.enabled;
  } catch {
    return false;
  }
}
