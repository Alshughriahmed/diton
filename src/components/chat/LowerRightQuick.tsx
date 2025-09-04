"use client";
import { busEmit } from "@/utils/bus";

export default function LowerRightQuick() {
  return (
    <div className="fixed bottom-6 inset-x-0 flex justify-center gap-3">
      <button
        onClick={() => busEmit("match:next")}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
      >
        Next
      </button>
      <button
        onClick={() => busEmit("peer:like")}
        className="px-4 py-2 rounded bg-pink-600 hover:bg-pink-700 text-white"
      >
        Like
      </button>
    </div>
  );
}
