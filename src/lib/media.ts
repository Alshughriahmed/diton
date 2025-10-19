// src/lib/media.ts
/* Client-only media helpers for local cam/mic.
 * Exports used by ChatClient:
 *   initLocalMedia(), getLocalStream(), toggleMic(), toggleCam(), switchCamera()
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
  try { localStorage.setItem(FACE_KEY, currentFacing); } catch {}
}

function baseVideoConstraints(face: "user" | "environment") {
  // مرن، يعمل على معظم الأجهزة
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: face, // المحاولة الأولى
    // لاحقًا سنسقط إلى deviceId إذا فشلت facingMode
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

  // 2) deviceId fall-back: اختر أول كاميرا توافق الوجه المطلوب
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vids = devices.filter((d) => d.kind === "videoinput");
    // heuristic: اسم يحتوي "front"/"back" أو ترتيب.
    const pick = vids.find((d) =>
      face === "user"
        ? /front|user/i.test(d.label)
        : /back|rear|environment/i.test(d.label)
    ) || (face === "user" ? vids[0] : vids[vids.length - 1]);

    if (!pick) throw new Error("no video device");

    return await navigator.mediaDevices.getUserMedia({
      video: { ...baseVideoConstraints(face), deviceId: { exact: pick.deviceId } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (e) {
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
  // لا نوقف الصوت إن كان سيُعاد استخدامه
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
 * Returns a fresh MediaStream that contains new video track
 * and (if available) reuses the existing audio track.
 */
export async function switchCamera(): Promise<MediaStream | null> {
  // بدّل الوجه المطلوب
  currentFacing = currentFacing === "user" ? "environment" : "user";
  saveFacing();

  // احتفظ بالصوت إن وُجد
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
