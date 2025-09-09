"use client";

import CountrySelect from "../filters/CountrySelect";
import GenderSelect from "../filters/GenderSelect";

/**
 * فلاتر أعلى يمين القسم العلوي (منطقة الطرف الثاني)
 * Country/Gender مع z-50 ومنسدلان
 */
export default function RemoteTopRight() {
  return (
    <div className="absolute top-4 right-4 z-50 flex gap-2">
      <CountrySelect />
      <GenderSelect />
    </div>
  );
}