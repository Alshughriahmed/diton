"use client";

import CountrySelect from "../filters/CountrySelect";
import GenderSelect from "../filters/GenderSelect";

/**
 * فلاتر أعلى يمين القسم العلوي (منطقة الطرف الثاني)
 * Country/Gender مع z-50 ومنسدلان
 */
export default function RemoteTopRight() {
  return (
    <div data-remote-top-right className="flex gap-2">
      <CountrySelect />
      <GenderSelect />
    </div>
  );
}