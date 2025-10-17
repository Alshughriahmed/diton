"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import safeFetch from "@/app/chat/safeFetch";
import { isFFA } from "@/utils/ffa";

export type GenderKey = "any" | "female" | "male" | "couples" | "lgbt";

const OPTIONS: { key: GenderKey; label: string; icon: string; color: string }[] = [
  { key: "any",     label: "Everyone", icon: "👥",       color: "bg-gray-800" },
  { key: "female",  label: "Female",   icon: "♀️",        color: "bg-red-500" },
  { key: "male",    label: "Male",     icon: "♂️",        color: "bg-blue-800" },
  { key: "couples", label: "Couples",  icon: "👫",        color: "bg-rose-600" },
  { key: "lgbt",    label: "LGBT",     icon: "🏳️‍🌈",     color: "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  selected: GenderKey[];               // بدون "any"
  onChange: (vals: GenderKey[]) => void;
};

export default function GenderModal({ open, onClose, selected, onChange }: Props) {
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    safeFetch("/api/user/vip-status").then(r => r.json()).then(j => {
      setIsVip(!!(j?.isVip || j?.vip));
    }).catch(() => {});
  }, []);

  // أعلم طبقة الإيماءات أن هناك مودال مفتوح
  useEffect(() => {
    (window as any).__modalOpen = !!open;
    return () => { (window as any).__modalOpen = false; };
  }, [open]);

  // غير VIP وغير FFA = Everyone فقط
  useEffect(() => {
    if (open && !(isFFA() || isVip) && selected.length > 0) onChange([]);
  }, [open, isVip, selected, onChange]);

  const toggle = (key: GenderKey) => {
    if (key === "any") { onChange([]); return; }
    if (!(isFFA() || isVip)) { onChange([]); return; }

    const set = new Set(selected);
    if (set.has(key)) set.delete(key);
    else {
      if (set.size >= 2) set.delete(Array.from(set)[0] as GenderKey); // VIP حد أقصى 2
      set.add(key);
    }
    onChange(Array.from(set) as GenderKey[]);
  };

  if (!open) return null;

  const body = (
    <div
      className="fixed inset-0 z-[1000] flex items-start md:items-center justify-center bg-black/50 p-2 md:p-6 pointer-events-auto"
      data-modal-root
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Gender Filter</h3>
          <button onClick={onClose} className="px-2 text-gray-500 hover:text-gray-900">✕</button>
        </div>

        <div className="grid grid-cols-1 gap-2 p-4">
          {OPTIONS.map((o) => {
            const disabled = (!(isFFA() || isVip) && o.key !== "any");
            const active = (o.key === "any" && selected.length === 0) || selected.includes(o.key);
            return (
              <button
                key={o.key}
                disabled={disabled}
                onClick={() => toggle(o.key)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-white ${active ? o.color : "bg-gray-700/70"} hover:brightness-110 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{o.icon}</span>
                  <span className="font-medium">{o.label}</span>
                </span>
                {active && <span className="text-xs bg-black/30 rounded-md px-2 py-1">Selected</span>}
              </button>
            );
          })}
          {!(isFFA() || isVip) && (
            <p className="text-xs text-gray-500 mt-1">Tip: VIP users can select up to two genders.</p>
          )}
        </div>

        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-black text-white">Done</button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
