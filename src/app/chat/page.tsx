"use client";

import dynamic from "next/dynamic";

// حمّل مكوّن LiveKit الذي كتبناه
const LiveKitClient = dynamic(() => import("./livekit"), { ssr: false });

export default function ChatPage() {
  // غرفة تجريبية اسمها lobby
  return <LiveKitClient roomName="lobby" />;
}
