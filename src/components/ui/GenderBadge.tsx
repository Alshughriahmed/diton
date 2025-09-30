"use client";
import React from "react";

type G = "male" | "female" | "couple" | "lgbt";
export function GenderBadge({ g, size="lg" }: { g: G; size?: "sm"|"md"|"lg"|"xl" }) {
  const map: Record<G,{label:string; symbol:React.ReactNode; className:string}> = {
    male:   { label:"Male",   symbol:"♂", className:"text-blue-600" },
    female: { label:"Female", symbol:"♀", className:"text-red-600" },
    couple: { label:"Couple", symbol:"⚥", className:"text-red-400" },
    lgbt:   { label:"LGBT",   symbol:(<><span className="bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">🏳️‍🌈 ⚧</span></>), className:"" },
  };
  const sz = { sm:"text-sm", md:"text-base", lg:"text-lg", xl:"text-xl" }[size];
  const item = map[g];
  return <span className={`inline-flex items-center gap-1 ${sz}`} aria-label={item.label}>
    <span className={item.className} aria-hidden>{item.symbol}</span>
    <span className={item.className}>{item.label}</span>
  </span>;
}
export default GenderBadge;