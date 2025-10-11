import dynamic from "next/dynamic";

const LiveKitTest = dynamic(() => import("../chat/livekit"), { ssr: false });
// لو وضعت المكوّن في مسار آخر عدّل المسار أعلاه accordingly

export default function Page() {
  return <LiveKitTest roomName="lobby" />;
}
