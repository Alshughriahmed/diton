"use client";
import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

export default function LiveKitTest({ roomName = "lobby" }: { roomName?: string }) {
  const [wsUrl, setWsUrl] = useState<string>();
  const [token, setToken] = useState<string>();

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomName }),
      });
      const j = await r.json();
      setWsUrl(j.wsUrl);
      setToken(j.token);
    })();
  }, [roomName]);

  if (!wsUrl || !token) return <div>Connecting…</div>;

  return (
    <LiveKitRoom serverUrl={wsUrl} token={token} connect>
      <VideoConference />
    </LiveKitRoom>
  );
}
