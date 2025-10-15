// src/app/chat/livekit.tsx
"use client";

import { useEffect, useRef } from "react";
import { Room, RoomEvent, Track, RemoteTrackPublication, RemoteTrack } from "livekit-client";

type Props = { roomName: string };

/**
 * مكوّن تجريبي صغير للاتصال بـ LiveKit يدويًا لغرض التشخيص.
 * لا يؤثر على ChatClient.tsx. آمن للفصل دون إيقاف التراكات المحلية.
 */
export default function LiveKitMinimal({ roomName }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let room: Room | null = null;
    let mounted = true;

    (async () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || "";
        if (!wsUrl) throw new Error("NEXT_PUBLIC_LIVEKIT_WS_URL missing");

        // اطلب التوكن
        const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent("tester-"+Math.random().toString(36).slice(2,8))}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) throw new Error("token request failed " + r.status);
        const { token } = await r.json();

        // أنشئ الغرفة واتصل
        room = new Room({ adaptiveStream: true, dynacast: true });
        await room.connect(wsUrl, token);

        // فعّل الكاميرا والمايك السريعين لهذه الصفحة فقط
        await room.localParticipant.setMicrophoneEnabled(true);
        const camPub = await room.localParticipant.setCameraEnabled(true);
        const camTrack = camPub?.track;
        if (mounted && localVideoRef.current && camTrack) {
          camTrack.attach(localVideoRef.current);
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.autoplay = true;
        }

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant) => {
          if (!mounted || !remoteWrapRef.current) return;
          const el = document.createElement(track.kind === Track.Kind.Video ? "video" : "audio");
          el.setAttribute("data-participant", participant?.identity || "remote");
          (el as any).autoplay = true;
          (el as any).playsInline = true;
          try { track.attach(el as any); } catch {}
          remoteWrapRef.current.appendChild(el);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          try { track.detach().forEach((el) => el.remove()); } catch {}
        });

        // اربط الشِّيم لأغراض الاختبار اليدوي
        try {
          (window as any).__lkRoom = room;
          (window as any).__ditonaDataChannel?.attach?.(room);
        } catch {}
      } catch (e) {
        console.error("[LiveKitMinimal] connect error:", e);
      }
    })();

    return () => {
      mounted = false;
      try {
        (window as any).__ditonaDataChannel?.detach?.();
        (window as any).__lkRoom = null;
        room?.disconnect(false); // لا توقف التراكات المحلية
      } catch {}
      room = null;
    };
  }, [roomName]);

  return (
    <div className="p-4 grid gap-4">
      <video ref={localVideoRef} className="w-full max-w-md rounded bg-black" />
      <div ref={remoteWrapRef} className="grid grid-cols-2 gap-2" />
    </div>
  );
}
