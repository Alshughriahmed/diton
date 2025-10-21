/* Media helpers for local cam/mic and camera cycling by deviceId.
 * Exports:
 *  - initLocalMedia(), getLocalStream(), toggleMic(), toggleCam(), getMicState()
 *  - enumerateVideoInputs(), switchCameraCycle(room?, localVideoEl?)
 *  - getCurrentFacing(), isTorchSupported(), toggleTorch()
 */


let localStream: MediaStream | null = null;

type Facing = "user" | "environment";
type VideoDevice = { deviceId: string; label: string; facing: Facing };

let devicesCached: VideoDevice[] = [];
let order: VideoDevice[] = []; // front1→front2→back1→back2
let currentIndex = 0;

const FACE_KEY = "ditona_cam_face";
const IDX_KEY = "ditona_cam_index";

function guessFacing(label: string): Facing {
  const s = (label || "").toLowerCase();
  if (/back|rear|environment|tele|zoom/i.test(s)) return "environment";
  return "user";
}

function emitMediaState() {
  try {
    const micOn = getMicState();
    const torch = isTorchSupported();
    const facing = getCurrentFacing();
    window.dispatchEvent(new CustomEvent("media:state", { detail: { micOn, torchSupported: torch, facing } }));
  } catch {}
}

function baseVideoConstraints(): MediaTrackConstraints {
  return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
}

function setLocalStream(newStream: MediaStream) {
  // أوقف فقط فيديو القديم، وأبقِ الصوت
  try {
    const oldVid = localStream?.getVideoTracks?.()[0];
    if (oldVid) oldVid.stop();
  } catch {}
  localStream = newStream;
}

export function getLocalStream(): MediaStream | null {
  return localStream;
}

export async function enumerateVideoInputs(): Promise<VideoDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  const vids = all
    .filter((d) => d.kind === "videoinput")
    .map((d) => ({ deviceId: d.deviceId, label: d.label || "", facing: guessFacing(d.label) as Facing }));
  devicesCached = vids;

  // بناء ترتيب ثابت: fronts ثم backs
  const fronts = vids.filter((v) => v.facing === "user");
  const backs = vids.filter((v) => v.facing === "environment");
  // حافظ على الاستقرار الداخلي بالترتيب الأصلي
  order = [...fronts, ...backs];

  // اضبط مؤشر البداية على أول front إن وجد وإلا صفر
  const savedIdx = Number(localStorage.getItem(IDX_KEY) || "0");
  currentIndex = Number.isFinite(savedIdx) ? Math.min(Math.max(0, savedIdx), Math.max(0, order.length - 1)) : 0;
  if (order.length && order[currentIndex]?.facing !== "user") currentIndex = 0;
  localStorage.setItem(IDX_KEY, String(currentIndex));
  return order;
}

export async function initLocalMedia(): Promise<MediaStream> {
  await enumerateVideoInputs().catch(() => {});
  const firstId = order[0]?.deviceId;
  const constraints: MediaStreamConstraints = {
    video: firstId ? { ...baseVideoConstraints(), deviceId: { exact: firstId } } : { ...baseVideoConstraints() },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  };
  const s = await navigator.mediaDevices.getUserMedia(constraints);
  setLocalStream(s);
  emitMediaState();
  return s;
}

export function toggleMic(): boolean {
  const a = localStream?.getAudioTracks?.()[0];
  if (!a) return false;
  a.enabled = !a.enabled;
  emitMediaState();
  return a.enabled;
}

export function toggleCam(): boolean {
  const v = localStream?.getVideoTracks?.()[0];
  if (!v) return false;
  v.enabled = !v.enabled;
  return v.enabled;
}

export function getMicState(): boolean {
  try {
    const a = localStream?.getAudioTracks?.()[0];
    return !!a?.enabled;
  } catch {
    return false;
  }
}

export function getCurrentFacing(): Facing {
  try {
    const v = localStream?.getVideoTracks?.()[0];
    const label = v?.label || "";
    return guessFacing(label);
  } catch {
    return "user";
  }
}

export function isTorchSupported(): boolean {
  try {
    const v: any = localStream?.getVideoTracks?.()[0];
    const caps = v?.getCapabilities?.();
    return !!caps?.torch;
  } catch {
    return false;
  }
}

export async function toggleTorch(on?: boolean): Promise<boolean> {
  try {
    const v: any = localStream?.getVideoTracks?.()[0];
    if (!v) return false;
    const caps = v.getCapabilities?.();
    if (!caps?.torch) return false;
    const cur = v.getSettings?.().torch as boolean | undefined;
    const target = typeof on === "boolean" ? on : !cur;
    await v.applyConstraints({ advanced: [{ torch: target }] });
    emitMediaState();
    return true;
  } catch {
    return false;
  }
}

/** Cycle to next available camera in session-stable order.
 * - Works without an active room: updates local preview stream only.
 * - When room provided: tries replaceTrack(newTrack), fallback to unpublish/publish.
 * - Skips missing/unavailable devices automatically.
 * - Returns true on success, false on failure.
 */
let switching = false;
export async function switchCameraCycle(room?: any, localVideoEl?: HTMLVideoElement): Promise<boolean> {
  if (switching) return false;
  switching = true;
  const release = () => {
    switching = false;
    emitMediaState();
  };

  try {
    if (!order.length) await enumerateVideoInputs().catch(() => {});
    if (!order.length) return false;

    // جرّب بحد أقصى عدد الأجهزة للعثور على جهاز صالح
    let tried = 0;
    let newStream: MediaStream | null = null;
    let nextIdx = currentIndex;

    while (tried < order.length && !newStream) {
      nextIdx = (nextIdx + 1) % order.length;
      const dev = order[nextIdx];
      try {
        const constraints: MediaStreamConstraints = {
          video: { ...baseVideoConstraints(), deviceId: { exact: dev.deviceId } },
          audio: false, // نعيد استخدام الصوت القديم
        };
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        newStream = null;
      }
      tried++;
    }

    if (!newStream) return false;

    const newVideo = newStream.getVideoTracks()[0];
    if (!newVideo) return false;

    // دمج الصوت القديم
    const oldAudio = localStream?.getAudioTracks?.()[0] || null;
    const merged = new MediaStream();
    merged.addTrack(newVideo);
    if (oldAudio) merged.addTrack(oldAudio);

    // عيّن المعاينة المحلية دائمًا
    if (localVideoEl) {
      try {
        (localVideoEl as any).srcObject = merged;
        await (localVideoEl as any).play?.();
      } catch {}
    }

    // استبدل في LiveKit إن وُجد room متصل
    if (room && room.state === "connected") {
      try {
        const lp: any = room.localParticipant;
        // ابحث عن منشور الفيديو
        let pub: any =
          typeof lp.getTrackPublication === "function" ? lp.getTrackPublication(1 /* Track.Source.Camera */) : null;
        if (!pub) {
          const pubs =
            typeof lp.getTrackPublications === "function"
              ? lp.getTrackPublications()
              : Array.from(lp.trackPublications?.values?.() ?? []);
          pub =
            pubs.find((p: any) => p?.source === 1 || p?.kind === 0) ||
            pubs.find((p: any) => p?.track?.mediaStreamTrack?.kind === "video");
        }

        // حاول replaceTrack أولًا
        if (pub && typeof pub.replaceTrack === "function") {
          try {
            await pub.replaceTrack(newVideo);
          } catch {
            // فالـباك
            try {
              if (pub?.track) await lp.unpublishTrack(pub.track, { stop: false });
              await lp.publishTrack(newVideo);
            } catch {}
          }
        } else {
          try {
            if (pub?.track) await lp.unpublishTrack(pub.track, { stop: false });
            await lp.publishTrack(newVideo);
          } catch {}
        }
      } catch {
        // تجاهل، المعاينة ما زالت تعمل
      }
    }

    // بدّل المرجع المحلي
    setLocalStream(merged);

    // حدّث الفهرس واحفظه
    currentIndex = nextIdx;
    localStorage.setItem(IDX_KEY, String(currentIndex));

    return true;
  } finally {
    release();
  }
}
