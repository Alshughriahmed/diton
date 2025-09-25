"use client";
type Props = { country?: string; city?: string; gender?: string };
export default function PeerMetaBottomLeft({ country="Unknown", city="—", gender="—" }: Props){
  return (
    <div className="absolute left-3 bottom-3 z-[40] rounded-xl bg-black/50 backdrop-blur px-3 py-2 border border-white/10 text-sm">
      <div className="opacity-80">{country}{city ? ` • ${city}` : ""}</div>
      <div className="opacity-60 text-[12px]">{gender}</div>
    </div>
  );
}