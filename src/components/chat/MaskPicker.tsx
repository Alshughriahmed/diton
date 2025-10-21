// src/components/chat/MaskPicker.tsx
"use client";
import { useEffect, useState } from "react";
import { emit } from "@/utils/events";

type MaskKind = "none" | "blur" | "pixel" | "emoji1" | "emoji2" | "emoji3";

export default function MaskPicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<MaskKind>("none");

  useEffect(() => {
    const onToggle = () => setOpen(v => !v);
    window.addEventListener("ui:toggleMasks" as any, onToggle);
    return () => window.removeEventListener("ui:toggleMasks" as any, onToggle);
  }, []);

  if (!open) return null;

  const Item = ({ k, label }: { k: MaskKind; label: string }) => (
    <button
      onClick={() => {
        setCurrent(k);
        emit("effects:setMask", { kind: k });
        setOpen(false);
      }}
      className={`px-3 py-2 rounded-lg border text-sm ${
        current === k ? "bg-white/15 border-white/50" : "bg-white/5 border-white/20 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end p-3">
      <div className="w-full max-w-sm bg-black/70 backdrop-blur-md rounded-2xl border border-white/15 p-3 text-white">
        <div className="font-semibold mb-2">Masks</div>
        <div className="grid grid-cols-2 gap-2">
          <Item k="none" label="None" />
          <Item k="blur" label="Blur face" />
          <Item k="pixel" label="Pixelate face" />
          <Item k="emoji1" label="Emoji 😎" />
          <Item k="emoji2" label="Emoji 😶" />
          <Item k="emoji3" label="Emoji 🐱" />
        </div>
        <div className="mt-3 text-xs text-white/70">
          Uses built-in FaceDetector when available. Falls back to a center region.
        </div>
      </div>
    </div>
  );
}
