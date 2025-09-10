"use client";
import { useFilters, type GenderOpt } from "@/state/filters";
import { GENDERS } from "@/data/genders";

export default function GenderSelect(){
  const { gender, setGender, isVip } = useFilters();
  const freeForAll = process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1";
  return (
    <div className="absolute top-2 right-40 z-50">
      <div className="inline-flex items-center gap-2">
        <label className="text-xs opacity-70">Gender</label>
        <select
          className="px-2 py-1 rounded-md bg-neutral-800 text-white text-sm border border-neutral-700"
          value={gender}
          onChange={(e)=>setGender(e.target.value as GenderOpt)}
          disabled={!isVip && !freeForAll}
          aria-label="Select gender"
        >
          {GENDERS.map((g)=>(
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        {!isVip && !freeForAll && <span className="text-[10px] opacity-60">VIP</span>}
      </div>
    </div>
  );
}
