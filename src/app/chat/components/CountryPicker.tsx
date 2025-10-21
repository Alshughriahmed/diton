"use client";

import { useEffect, useMemo, useState } from "react";
import { useFilters } from "@/state/filters";
import { flagEmoji } from "@/lib/flags";
import countriesRaw from "world-countries"; // npm i world-countries

type Item = { code: string; name: string; flag: string };

function getMyCountryCode(): string | null {
  try {
    const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
    const c = typeof g?.country === "string" ? g.country.toUpperCase() : null;
    return c && /^[A-Z]{2}$/.test(c) ? c : null;
  } catch {
    return null;
  }
}

export default function CountryPicker({ onClose }: { onClose: () => void }) {
  const filters = useFilters();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>(Array.isArray(filters.countries) ? filters.countries : []);
  const myCode = useMemo(() => getMyCountryCode(), []);
  const ALL: Item[] = useMemo(() => {
    const arr = countriesRaw.map((c) => ({
      code: String(c.cca2).toUpperCase(),
      name: String(c.name?.common || "").trim(),
      flag: flagEmoji(String(c.cca2)),
    }));
    // إن وجِدت دولة المستخدم ضعها في البداية
    arr.sort((a, b) => {
      if (myCode && a.code === myCode) return -1;
      if (myCode && b.code === myCode) return 1;
      return a.name.localeCompare(b.name, "en");
    });
    return arr;
  }, [myCode]);

  const MAX = 15;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ALL;
    return ALL.filter((x) => x.name.toLowerCase().includes(s) || x.code.toLowerCase().includes(s));
  }, [ALL, q]);

  function toggle(code: string) {
    setSel((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX) return prev; // قفل عند 15
      return [...prev, code];
    });
  }

  function selectAll() {
    setSel([]); // معناها “كل الدول”
  }

  function apply() {
    filters.setCountries(sel.slice(0, MAX));
    onClose();
  }

  // إظهار عدّاد وحدّ الاختيار
  const countText = sel.length === 0 ? "All countries" : `${sel.length}/${MAX} selected`;

  // إغلاق بـ ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm">
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <div className="text-2xl font-semibold">Country Filter</div>
            <div className="text-sm text-slate-300">Choose which country you would like to connect to.</div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search country"
              className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-2 outline-none focus:border-white/30"
            />
          </div>

          <button
            onClick={selectAll}
            className="w-full flex items-center justify-between rounded-lg border border-white/15 bg-black/20 px-3 py-2 hover:bg-black/30"
          >
            <span className="flex items-center gap-3">
              <span className="text-xl">🌐</span>
              <span className="font-medium">All countries</span>
            </span>
            <span className="text-sm text-slate-300">{countText}</span>
          </button>

          <div className="max-h-[55vh] overflow-auto rounded-xl border border-white/10 divide-y divide-white/5">
            {filtered.map((c) => {
              const checked = sel.includes(c.code);
              const disabled = !checked && sel.length >= MAX;
              return (
                <button
                  key={c.code}
                  onClick={() => toggle(c.code)}
                  disabled={disabled}
                  className={`w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-800/60 ${
                    disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{c.flag}</span>
                    <span className="text-base">{c.name}</span>
                  </span>
                  <input type="checkbox" readOnly checked={checked} className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-black/30 border border-white/15 hover:bg-black/40">
              Cancel
            </button>
            <button
              onClick={apply}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
