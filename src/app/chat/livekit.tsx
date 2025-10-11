"use client";

import { Room, RoomEvent, Track, RemoteTrackPublication, RemoteTrack } from "livekit-client";
import { useEffect, useRef } from "react";

export default function LiveKitMinimal({ roomName }: { roomName: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let room: Room | null = null;

    (async () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL as string;
        const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}`, { credentials: "include" });
        const { token } = await r.json();

        room = new Room();
        await room.connect(wsUrl, token);

        // فعّل الصوت
        await room.localParticipant.setMicrophoneEnabled(true);

        // فعّل الكاميرا وأرفق الـtrack المحلي للفيديو
        const camPub = await room.localParticipant.setCameraEnabled(true); // LocalTrackPublication | undefined
        const camTrack = camPub?.track; // LocalVideoTrack | undefined
        if (localVideoRef.current && camTrack) {
          camTrack.attach(localVideoRef.current);
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.autoplay = true;
        }

        // عند الاشتراك بمسار بعيد
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, pub: RemoteTrackPublication, participant) => {
            if (!remoteWrapRef.current) return;
            const el = document.createElement(track.kind === Track.Kind.Video ? "video" : "audio");
            el.setAttribute("data-participant", participant.identity);
            (el as any).autoplay = true;
            (el as any).playsInline = true;
            track.attach(el as any);
            remoteWrapRef.current.appendChild(el);
          }
        );

        // تنظيف عند إلغاء الاشتراك
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });
      } catch (e) {
        console.error("livekit connect error", e);
      }
    })();

    return () => {
      try { room?.disconnect(); } catch {}
      room = null;
    };
  }, [roomName]);

  return (
    <div className="p-4 grid gap-4">
      <video ref={localVideoRef} className="w-full max-w-md rounded" />
      <div ref={remoteWrapRef} className="grid grid-cols-2 gap-2" />
    </div>
  );
}
