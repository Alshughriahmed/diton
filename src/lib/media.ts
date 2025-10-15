// src/lib/media.ts
// إدارة وسائط محلية بدون إيقاف التراكات بين Next/Prev.
// وظائف مستخدمة: initLocalMedia, getLocalStream, toggleMic, toggleCam, switchCamera.

let _stream: MediaStream | null = null;
let _lastDeviceId: string | null = null;

// أداة آمنة لاستدعاء mediaDevices
function md() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    throw new Error("mediaDevices unavailable");
  }
  return navigator.mediaDevices;
}

export function getLocalStream(): MediaStream | null {
  return _stream;
}

export async function initLocalMedia(): Promise<MediaStream> {
  // إن وُجدت جلسة حيّة استعملها
  if (_stream && _stream.getTracks().some((t) => t.readyState === "live")) {
    return _stream;
  }

  const constraints: MediaStreamConstraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  };

  _stream = await md().getUserMedia(constraints);
  const v = _stream.getVideoTracks()[0];
  if (v) {
    const s = v.getSettings();
    _lastDeviceId = (s.deviceId as string) || null;
  }
  return _stream;
}

export function toggleMic(): boolean {
  if (!_stream) return false;
  const tracks = _stream.getAudioTracks();
  if (!tracks.length) return false;
  const enabled = !tracks.every((t) => t.enabled === true);
  // إن لم تكن كلها مُمكّنة، فعِّل الكل، وإلا عطّل الكل
  const next = tracks.some((t) => t.enabled === false) ? true : !enabled;
  tracks.forEach((t) => (t.enabled = next));
  return next;
}

export function toggleCam(): boolean {
  if (!_stream) return false;
  const tracks = _stream.getVideoTracks();
  if (!tracks.length) return false;
  const next = !tracks[0].enabled;
  tracks.forEach((t) => (t.enabled = next));
  return next;
}

export async function switchCamera(): Promise<MediaStream> {
  // احصل على قائمة كاميرات
  const devices = await md().enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput");
  if (!cams.length) throw new Error("no cameras");

  // اختر التالية بعد الحالية
  let idx = 0;
  if (_lastDeviceId) {
    const curIdx = cams.findIndex((d) => d.deviceId === _lastDeviceId);
    idx = (curIdx + 1) % cams.length;
  }
  const target = cams[idx];

  // أنشئ دفقًا جديدًا من الكاميرا المختارة. لا توقف المايك.
  const newVideo = await md().getUserMedia({
    video: { deviceId: { exact: target.deviceId } },
    audio: false,
  });

  // دمج: استبدل فيديو فقط داخل الـstream الحالي أو اعتمده كجديد
  if (_stream) {
    // انزع الفيديو القديم من _stream وأوقفه لتحرير الكاميرا السابقة فقط
    _stream.getVideoTracks().forEach((t) => {
      try {
        _stream!.removeTrack(t);
        t.stop();
      } catch {}
    });
    // أضف فيديو جديد
    const nv = newVideo.getVideoTracks()[0];
    if (nv) _stream.addTrack(nv);
  } else {
    // إن لم توجد جلسة سابقة، أنشئ واحدة بفيديو فقط
    _stream = new MediaStream(newVideo.getVideoTracks());
  }

  _lastDeviceId = target.deviceId;
  return _stream!;
}
