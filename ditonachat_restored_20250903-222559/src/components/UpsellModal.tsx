"use client";
import React from "react";

export default function UpsellModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-[360px] max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-3">Go VIP</h3>
        <p className="text-sm text-neutral-600 mb-4">
          Unlock unlimited messages, HD quality, and more.
        </p>
        <div className="mt-5 flex justify-end">
          <button className="text-sm px-3 py-1.5 rounded border" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
