"use client";
import React from "react";

type PeerInfo = any;
export default function PeerHeader({ peer }: { peer?: PeerInfo }) {
  const name = (peer && (peer.name || peer.username)) || "Guest";
  const country = (peer && (peer.country || peer.locale)) || "Unknown";
  const avatar = peer?.avatarUrl || peer?.avatar || null;
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-10 h-10 rounded-full bg-neutral-200 overflow-hidden">
        {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex flex-col">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-[11px] text-neutral-500">{country}</div>
      </div>
    </div>
  );
}
