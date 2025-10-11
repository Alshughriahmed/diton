"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

export default function LiveKitTest({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}`, { credentials: "include" });
        const j = await r.json();
        if (alive) setToken(j?.token || "");
      } catch {
        setToken("");
      }
    })();
    return () => { alive = false; };
  }, [roomName]);

  if (!token) return <div style={{ padding: 12 }}>Getting LiveKit token…</div>;

  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL as string;
  return (
    <LiveKitRoom serverUrl={url} token={token} connect>
      <VideoConference />
    </LiveKitRoom>
  );
}
