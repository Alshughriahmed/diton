"use client";
import { useEffect, useMemo, useState } from "react";
import { getAllRegions, Region } from "@/lib/regions";

type Props = {
  open: boolean;
  onClose: () => void;
  selected: string[];            // ISO codes; [] == All
  onChange: (codes: string[]) => void;
};

const LAUNCH_OPEN = true; // الإطلاق التجريبي

export default function CountryModal({ open, onClose, selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [sel, setSel] = useState<string[]>(selected ?? []);

  useEffect(() => { setRegions(getAllRegions()); }, []);
  useEffect(() => { setSel(selected ?? []); }, [selected]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = regions.filter(r => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    return arr;
  }, [regions, query]);

  const toggle = (code: string) => {
    const s = new Set(sel);
    if (s.has(code)) s.delete(code);
    else {
      s.add(code);
      const limit = LAUNCH_OPEN ? 15 : 1;    // لاحقًا: اربطها بـ VIP/FFA
      while (s.size > limit) s.delete(Array.from(s)[0]);
    }
    const arr = Array.from(s);
    setSel(arr); onChange(arr);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start md:items-center justify-center bg-black/50 p-2 md:p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white text-gray-900 shadow-xl pointer-events-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Country Filter</h3>
          <button onClick={onClose} className="px-2 text-gray-500 hover:text-gray-900">✕</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            placeholder="Search country"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
          />
          <div className="mt-3 max-h-[60vh] overflow-y-auto divide-y">
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600">
                Default: <strong>All Countries</strong>
              </div>
              <button
                onClick={()=>{ setSel([]); onChange([]); }}
                className="text-xs px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100"
                title="Reset to All Countries"
              >
                Select All
              </button>
            </div>
            {list.map(r=>(
              <label key={r.code} className="flex items-center gap-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={sel.includes(r.code)}
                  onChange={()=>toggle(r.code)}
                />
                <span className="text-xl">{r.flag}</span>
                <span className="flex-1">{r.name}</span>
                <span className="text-xs text-gray-500">{r.code}</span>
              </label>
            ))}
            {list.length===0 && (
              <div className="py-6 text-sm text-gray-500">No results</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={()=>{ setSel([]); onChange([]); }} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">All</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-black text-white">Done</button>
        </div>
      </div>
    </div>
  );
}
