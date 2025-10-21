"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import ChatClient from "./ChatClient";

export default function Page() {
  return <ChatClient />;
}
