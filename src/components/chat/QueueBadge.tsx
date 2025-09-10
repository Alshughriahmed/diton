"use client";
import { useQueueLen } from "@/hooks/useQueueLen";
import { useHydrated } from "@/hooks/useHydrated";
export default function QueueBadge() {
  const hydrated = useHydrated();
  const { len, mode } = useQueueLen(5000);
  if (!hydrated) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
      <div className="bg-black/60 backdrop-blur-md rounded-full px-3 py-1 border border-white/10 text-xs text-white shadow">
        <span className="mr-2">Queue</span>
        <span className="font-semibold">{len}</span>
        <span className="ml-2 text-[10px] opacity-70">({mode ?? "…"})</span>
      </div>
    </div>
  );
}
