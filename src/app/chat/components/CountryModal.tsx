"use client";
import { useEffect, useMemo, useState } from "react";
import { getAllRegions, Region } from "@/lib/regions";

type Props = {
  open: boolean;
  onClose: () => void;
  selected: string[];            // ISO codes; [] == All
  onChange: (codes: string[]) => void;
};

export default function CountryModal({ open, onClose, selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    setRegions(getAllRegions());
    // user country
    fetch("/api/geo").then(r=>r.json()).then(j=>{
      const code = (j?.countryCode || j?.country || "").toString().toUpperCase();
      if (code && /^[A-Z]{2}$/.test(code)) setUserCode(code);
    }).catch(()=>{});
    // vip status
    fetch("/api/user/vip-status").then(r=>r.json()).then(j=>{
      setIsVip(!!(j?.isVip || j?.vip));
    }).catch(()=>{});
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = regions.filter(r => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    // put user country first
    if (userCode) {
      arr = arr.sort((a,b) => (a.code===userCode? -1: b.code===userCode? 1: a.name.localeCompare(b.name)));
    }
    return arr;
  }, [regions, query, userCode]);

  // [] means All; badge handled outside

  const toggle = (code: string) => {
    // Non-VIP: only own country allowed; if unknown, keep All
    if (!isVip) {
      if (userCode) onChange([userCode]);
      else onChange([]); // All
      return;
    }
    // VIP: up to 15 countries
    const set = new Set(selected);
    if (set.has(code)) {
      set.delete(code);
    } else {
      set.add(code);
      if (set.size > 15) {
        // drop oldest deterministically
        const oldest = Array.from(set)[0];
        set.delete(oldest);
      }
    }
    onChange(Array.from(set));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/50 p-2 md:p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white text-gray-900 shadow-xl" onClick={e=>e.stopPropagation()}>
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
            {/* All control */}
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600">
                Default: <strong>All Countries</strong>
              </div>
              <button
                onClick={()=>onChange([])}
                className="text-xs px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100"
                title="Reset to All"
              >
                Select All
              </button>
            </div>
            {list.map(r=>(
              <label key={r.code} className="flex items-center gap-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selected.includes(r.code)}
                  onChange={()=>toggle(r.code)}
                  disabled={!isVip && !!userCode && r.code !== userCode}
                  title={!isVip && !!userCode && r.code !== userCode ? "Only your country is allowed for non-VIP" : ""}
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
          <button onClick={()=>onChange([])} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">All</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-black text-white">Done</button>
        </div>
      </div>
    </div>
  );
}
