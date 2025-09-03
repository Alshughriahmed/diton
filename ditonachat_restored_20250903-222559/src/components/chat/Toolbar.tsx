"use client";
import React from "react";

type Props = {
  onNext?: () => void;
  onLike?: () => void;
  peerId?: string | number | null | undefined;
};

export default function Toolbar({ onNext, onLike, peerId }: Props) {
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 bg-black/40">
      <button className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm" onClick={onNext}>Next</button>
      <button className="px-3 py-1.5 rounded bg-pink-600 text-white text-sm" onClick={onLike}>❤️ Like</button>
      <div className="ml-auto text-[11px] text-neutral-300">Peer: {String(peerId ?? '—')}</div>
    </div>
  );
}
