"use client";
import { useEffect, useState } from "react";
export default function useVisualViewportOffset(){
  const [off, setOff] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv:any = (window as any).visualViewport;
    if (!vv) return;
    const calc = () => {
      try {
        const h = vv.height ?? window.innerHeight;
        const t = vv.offsetTop ?? 0;
        const delta = (h + t) - window.innerHeight;
        setOff(Math.max(0, Math.round(delta)));
      } catch {}
    };
    calc();
    vv.addEventListener("resize", calc);
    vv.addEventListener("scroll", calc);
    return () => {
      vv.removeEventListener("resize", calc);
      vv.removeEventListener("scroll", calc);
    };
  }, []);
  return off;
}
