// src/app/chat/components/PeerOverlay.tsx
"use client";

export default function PeerOverlay() {
  return (
    <>
      {/* شارة أعلى يسار: صورة/اسم/تاج/لايكات B */}
      <div
        className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-2 rounded-xl bg-black/20 backdrop-blur-md px-3 py-1 text-sm text-white"
        aria-label="peer-top-left"
      >
        {/* الصورة المصغّرة للطرف */}
        <img
          data-ui="peer-avatar"
          alt="avatar"
          className="h-6 w-6 rounded-full object-cover hidden"
        />
        {/* الاسم */}
        <span data-ui="peer-name" className="font-medium" />
        {/* VIP */}
        <span data-ui="peer-vip" />
        {/* لايكات */}
        <span className="inline-flex items-center gap-1">
          <span>💗</span>
          <span data-ui="peer-likes" />
        </span>
      </div>

      {/* بطاقة أسفل يسار: الدولة/المدينة/الجندر B */}
      <div
        className="pointer-events-none absolute left-3 bottom-3 z-40 flex items-center gap-2 rounded-xl bg-black/20 backdrop-blur-md px-3 py-1 text-sm text-white"
        aria-label="peer-bottom-left"
      >
        <span data-ui="peer-country" className="uppercase" />
        <span className="opacity-60">—</span>
        <span data-ui="peer-city" />
        <span data-ui="peer-gender" className="ml-2" />
      </div>

      {/* مؤثر القلوب (يملؤه peerMetaUi عند like:sync) */}
      <div
        data-ui="like-hearts"
        className="pointer-events-none absolute inset-0 z-40"
        aria-hidden="true"
      />
    </>
  );
}
