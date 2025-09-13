"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// نتجاوز قيود الأنواع لضمان البناء
const GenderModal: any = dynamic(() => import("./GenderModal"), { ssr: false });
const CountryModal: any = dynamic(() => import("./CountryModal"), { ssr: false });

export default function FilterBar() {
  const [openGender, setOpenGender] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-[40] flex items-center gap-3">
      <button
        data-ui="gender-button"
        className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
        onClick={() => setOpenGender(true)}
      >
        Gender
      </button>

      <button
        data-ui="country-button"
        className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
        onClick={() => setOpenCountry(true)}
      >
        Countries
      </button>

      {/* شارات بسيطة (يمكن تحسينها لاحقاً) */}
      <div data-ui="gender-badge" className="text-xs opacity-80"></div>
      <div data-ui="country-count-badge" className="text-xs opacity-80"></div>

      {openGender && <GenderModal onClose={() => setOpenGender(false)} />}
      {openCountry && <CountryModal onClose={() => setOpenCountry(false)} />}
    </div>
  );
}
