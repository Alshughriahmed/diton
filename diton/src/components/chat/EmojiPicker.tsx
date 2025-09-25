"use client";
import React from "react";

const EMOJIS = "😀😄😁😆🥹😊🙂😉😍😘😜🤪🤗🤔🤨😐😴🥳🤩😎😇😭😤😡👍👎👏🙏💪🔥✨🎉❤️🧡💛💚💙💜🖤🤍💯✅❌".split("");

export default function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div 
      data-testid="emoji-panel" 
      className="absolute bottom-14 left-2 z-50 grid grid-cols-8 gap-2 p-2 rounded-2xl bg-neutral-900/95 shadow-lg border border-neutral-700"
    >
      {EMOJIS.map((e, i) => (
        <button 
          key={i} 
          onClick={() => onPick(e)} 
          className="text-xl hover:scale-110 transition" 
          aria-label={`emoji ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}