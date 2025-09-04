"use client";
import React from "react";

type Msg = { text: string; sender?: string };
type Mode = "latest"|"history";

/** Usage: <ChatMessages messages={msgs} mode="latest" /> */
export default function ChatMessages({ messages = [] as Msg[], mode = "history" as Mode }: { messages?: Msg[], mode?: Mode }) {
  const list = mode === "latest" ? messages.slice(-3) : messages;
  return (
    <div className="h-full overflow-y-auto p-4 space-y-2">
      {list.map((m, i) => (
        <div key={i} className={`text-sm ${m.sender==='me' ? 'text-white' : 'text-neutral-200'}`}>
          {m.text}
        </div>
      ))}
    </div>
  );
}