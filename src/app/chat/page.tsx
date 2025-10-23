// server wrapper for chat
export const dynamic = "force-dynamic";
export const revalidate = 0;

import ChatClient from "./ChatClient"; // ChatClient عليه "use client"

export default function Page() {
  return <ChatClient />;
}
