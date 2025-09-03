"use client";
import React from "react";
import { busEmit } from "@/utils/bus";

export default function LowerRightQuick() {
  return (
    <div className="flex flex-col gap-2 items-end">
      <button
        className="px-2 py-1 rounded bg-black/60 text-white text-xs"
        onClick={() => busEmit('match:next')}
      >Next</button>
      <button
        className="px-2 py-1 rounded bg-pink-600 text-white text-xs"
        onClick={() => busEmit('peer:like')}
      >❤️ Like</button>
    </div>
  );
}
