"use client";

import { Room, RoomEvent, RemoteTrackPublication, Track } from "livekit-client";
import { useEffect, useRef } from "react";

export default function LiveKitMinimal({ roomName }: { roomName: string }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let room: Room | null = null;

    (async () => {
      try {
        // استخدم عنوان WebSocket العلني من المتغيرات
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL as string;
        const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}`, {
          credentials: "include",
        });
        const { token } = await r.json();

        room = new Room();
        await room.connect(wsUrl, token);

        // فعّل الصوت والفيديو
        await room.localParticipant.setMicrophoneEnabled(true);
        const camTrack = await room.localParticipant.setCameraEnabled(true); // LocalVideoTrack

        // عرض الكاميرا المحلية
        if (localVideoRef.current && camTrack) {
          camTrack.attach(localVideoRef.current);
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.autoplay = true;
        }

        // عرض المسارات البعيدة
        room.on(RoomEvent.TrackSubscribed, (_track, pub: RemoteTrackPublication, participant) => {
          if (!remoteWrapRef.current) return;
          const el = document.createElement(pub.kind === Track.Kind.Video ? "video" : "audio");
          el.setAttribute("data-participant", participant.identity);
          (el as any).autoplay = true;
          (el as any).playsInline = true;
          pub.track?.attach(el as any);
          remoteWrapRef.current.appendChild(el);
        });

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
