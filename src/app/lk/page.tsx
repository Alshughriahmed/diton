"use client";

import LiveKitTest from "../chat/livekit"; // عدّل المسار إذا الملف بمكان آخر

export default function Page() {
  return <LiveKitTest roomName="lobby" />;
}
