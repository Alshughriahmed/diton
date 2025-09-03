// DitonaChat: BEGIN peer-meta
"use client";
import React from "react";
import { Gender, GENDER_ICON, GENDER_LABEL, GENDER_CLASSES } from "../../utils/gender";

interface PeerMetaProps {
  country?: string;
  city?: string; 
  gender?: Gender;
}

export default function PeerMeta({ country = "", city = "", gender = "unknown" }: PeerMetaProps) {
  const genderIcon = GENDER_ICON[gender];
  const genderLabel = GENDER_LABEL[gender];
  const genderClasses = GENDER_CLASSES[gender];

  const locationParts = [country, city].filter(Boolean);
  const locationText = locationParts.join(" · ") || "Hidden";

  return (
    <div className="pointer-events-none absolute left-2 bottom-2 z-40 flex gap-2">
      <span className="pointer-events-auto rounded-xl px-2 py-1 text-xs font-medium bg-black/40 text-white backdrop-blur">
        {locationText}
      </span>
      <span className={`pointer-events-auto rounded-xl px-2 py-1 text-xs font-semibold ${genderClasses}`}>
        {genderIcon} {genderLabel}
      </span>
    </div>
  );
}
// DitonaChat: END peer-meta