"use client";

import React from "react";

/**
 * Overlay ثابت للطرف B فقط.
 * لا منطق. فقط عناصر DOM المطلوبة مع data-ui الثابتة.
 * لا يوجد أي hidden/ md:flex قد يخفي على الموبايل.
 *
 * أعلى يسار: avatar + vip + likes + name
 * أسفل يسار: Country – City + Gender
 *
 * مهم:
 * - الحاوية الأب للفيديو البعيد يجب أن تكون relative + isolation-isolate
 * - هذا الـOverlay absolute inset-0 z-[60] pointer-events-none
 */

export default function PeerOverlay() {
  return (
    <div
      className="
        absolute inset-0 z-[60] pointer-events-none
        flex flex-col justify-between
      "
      aria-hidden="true"
    >
      {/* أعلى يسار */}
      <div className="p-3">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-black/20 backdrop-blur-sm px-2 py-1">
          {/* صورة/أفاتار الطرف B */}
          {/* إن لم تكن صورة فعلية في CSS، اتركها كـ <img/> خام */}
          <img
            data-ui="peer-avatar"
            alt=""
            className="h-5 w-5 rounded-full opacity-70"
            hidden
          />

          {/* اسم العرض اختياري */}
          <span data-ui="peer-name" className="text-white/90 text-xs sm:text-sm"></span>

          {/* شارة VIP */}
          <span data-ui="peer-vip" className="text-white/90 text-sm">🚫👑</span>

          {/* عدّاد إعجابات B */}
          <span className="text-pink-300 text-sm">❤</span>
          <span data-ui="peer-likes" className="text-pink-300 text-sm">0</span>
        </div>
      </div>

      {/* أسفل يسار */}
      <div className="p-3">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-black/20 backdrop-blur-sm px-3 py-1">
          {/* البلد — المدينة */}
          <span data-ui="peer-country" className="text-white/90 text-xs sm:text-sm"></span>
          <span className="text-white/40">–</span>
          <span data-ui="peer-city" className="text-white/90 text-xs sm:text-sm"></span>

          {/* رمز الجنس مكبّر وملوّن يملؤه peerMetaUi */}
          <span
            data-ui="peer-gender"
            className="ml-2 text-[1.5rem] sm:text-[1.75rem] leading-none"
          ></span>
        </div>
      </div>
    </div>
  );
}
