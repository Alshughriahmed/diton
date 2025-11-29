// src/app/chat/components/PeerOverlay.tsx
"use client";

export default function PeerOverlay() {
  return (
    <>
      {/* أعلى يسار: صورة/اسم/VIP/لايكات B */}
      <div
        className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-2 rounded-xl bg-black/20 backdrop-blur-md px-3 py-1 text-sm text-white"
        aria-label="peer-top-left"
      >
        <img data-ui="peer-avatar" alt="avatar" className="h-6 w-6 rounded-full object-cover hidden" />
        <span data-ui="peer-name" className="font-medium" />
        <span data-ui="peer-vip" className="ml-1" /> {/* 👑 أو 🚫👑 */}
        <span className="inline-flex items-center gap-1 ml-2">
          <span>💗</span>
          <span data-ui="peer-likes" />
        </span>
      </div>

      {/* أسفل يسار: الرمز ثم الدولة/المدينة */}
      <div
        className="pointer-events-none absolute left-3 bottom-3 z-40 flex items-center gap-2 rounded-xl bg-black/20 backdrop-blur-md px-3 py-1 text-sm text-white"
        aria-label="peer-bottom-left"
      >
        <span data-ui="peer-gender" className="text-xl font-extrabold" /> {/* ملوّن عبر JS */}
        <span data-ui="peer-country" className="uppercase" />
        <span className="opacity-60">—</span>
        <span data-ui="peer-city" />
      </div>

      {/* مؤثر القلوب (يملؤه peerMetaUi عند like:sync) */}
      <div data-ui="like-hearts" className="pointer-events-none absolute inset-0 z-40" aria-hidden="true" />
    </>
  );
}
