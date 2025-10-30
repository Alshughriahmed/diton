// src/app/chat/components/PeerOverlay.tsx
"use client";

export default function PeerOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* أعلى يسار: أفاتار + اسم + VIP + الإعجابات */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <img
          data-ui="peer-avatar"
          alt=""
          className="h-6 w-6 rounded-full object-cover ring-1 ring-white/20 hidden"
        />
        <span data-ui="peer-name" className="text-white/90 text-sm font-semibold" />
        <span data-ui="peer-vip" className="text-yellow-400 text-xs font-semibold" />
        <span data-ui="peer-likes" className="text-pink-400 text-sm font-semibold" />
      </div>

      {/* أسفل يسار: البلد + المدينة + الجنس (رمز فقط) */}
      <div className="absolute left-3 bottom-3 flex items-center gap-2">
        <span data-ui="peer-country" className="text-white/80 text-sm" />
        <span data-ui="peer-city" className="text-white/60 text-sm" />
        <span data-ui="peer-gender" className="text-white/90 text-sm font-semibold" />
      </div>
    </div>
  );
}
