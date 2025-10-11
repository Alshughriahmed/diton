"use client";

import { Room, RoomEvent, RemoteTrackPublication, Track } from "livekit-client";
import { useEffect, useRef } from "react";

type Props = { roomName: string };

export default function LiveKitMinimal({ roomName }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let room: Room | null = null;
    let stopped = false;

    (async () => {
      try {
        // خذ التوكن من روت الخادم
        const me = Math.random().toString(36).slice(2, 10);
        const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&user=${me}`);
        const { token, url } = await r.json();

        room = new Room();
        await room.connect(url, token);

        // فعّل مايك وكام
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);

        // اعرض الكام المحلي
        if (localVideoRef.current) {
          const pubs = room.localParticipant.videoTracks;
          const pub = Array.from(pubs.values())[0];
          const track = pub?.videoTrack;
          if (track) {
            track.attach(localVideoRef.current);
            localVideoRef.current.muted = true;
            localVideoRef.current.playsInline = true;
          }
        }

        // عند الاشتراك بأي تراك عن بُعد
        room.on(RoomEvent.TrackSubscribed, (_track, pub: RemoteTrackPublication, participant) => {
          if (!remoteWrapRef.current) return;
          const el = document.createElement(pub.kind === Track.Kind.Video ? "video" : "audio");
          el.setAttribute("data-participant", participant.identity);
          el.playsInline = true;
          if (pub.kind === Track.Kind.Video) (el as HTMLVideoElement).autoplay = true;
          pub.track?.attach(el);
          remoteWrapRef.current.appendChild(el);
        });

        // تنظيف عند إلغاء الاشتراك
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

      } catch (e) {
        console.error("livekit error", e);
      }
    })();

    return () => {
      stopped = true;
      try {
        if (room) {
          room.disconnect();
          room = null;
        }
      } catch {}
    };
  }, [roomName]);

  return (
    <div className="p-4 grid gap-4">
      <video ref={localVideoRef} className="w-full max-w-md rounded" autoPlay />
      <div ref={remoteWrapRef} className="grid grid-cols-2 gap-2" />
    </div>
  );
}
