// server wrapper for chat
export const dynamic = "force-dynamic";
export const revalidate = 0;

import dynamic from "next/dynamic";
const ChatClient = dynamic(() => import("./ChatClient"), { ssr: false });

export default function Page() {
  return <ChatClient />;
}
