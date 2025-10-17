"use client";
import { useEffect, useState } from "react";

export type GenderKey = "any" | "female" | "male" | "couples" | "lgbt";

const OPTIONS: {key: GenderKey; label: string; icon: string; color: string}[] = [
  { key:"any",     label:"Everyone", icon:"👥", color:"bg-gray-800" },
  { key:"female",  label:"Female",   icon:"♀️", color:"bg-red-500" },
  { key:"male",    label:"Male",     icon:"♂️", color:"bg-blue-800" },
  { key:"couples", label:"Couples",  icon:"👫", color:"bg-red-600" },
  { key:"lgbt",    label:"LGBT",     icon:"🏳️‍🌈", color:"bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  selected: GenderKey[];           // [] == Everyone
  onChange: (vals: GenderKey[]) => void;
};

const LAUNCH_OPEN = true; // الإطلاق التجريبي

export default function GenderModal({ open, onClose, selected, onChange }: Props) {
  const [sel, setSel] = useState<GenderKey[]>(selected ?? []);
  useEffect(()=>{ setSel(selected ?? []); }, [selected]);

  const toggle = (key: GenderKey) => {
    if (key === "any") { setSel([]); onChange([]); return; }
    const s = new Set(sel);
    if (s.has(key)) s.delete(key);
    else {
      s.add(key);
      const limit = LAUNCH_OPEN ? 2 : 1;      // لاحقًا: اربطها بـ VIP/FFA
      while (s.size > limit) s.delete(Array.from(s)[0] as GenderKey);
    }
    const arr = Array.from(s) as GenderKey[];
    setSel(arr); onChange(arr);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start md:items-center justify-center bg-black/50 p-2 md:p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-xl pointer-events-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Gender Filter</h3>
          <button onClick={onClose} className="px-2 text-gray-500 hover:text-gray-900">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-2 p-4">
          {OPTIONS.map(o=>{
            const active = (o.key === "any" && sel.length === 0) || sel.includes(o.key);
            return (
              <button
                key={o.key}
                onClick={()=>toggle(o.key)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-white ${active ? o.color : "bg-gray-700/70"} hover:brightness-110`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{o.icon}</span>
                  <span className="font-medium">{o.label}</span>
                </span>
                {active && <span className="text-xs bg-black/30 rounded-md px-2 py-1">Selected</span>}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-black text-white">Done</button>
        </div>
      </div>
    </div>
  );
}
