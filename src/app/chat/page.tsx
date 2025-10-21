// server wrapper for chat
export const dynamic = "force-dynamic";
export const revalidate = 0;

import NextDynamic from "next/dynamic";

const ChatClient = NextDynamic(() => import("./ChatClient"), { ssr: false });

export default function Page() {
  return <ChatClient />;
}
