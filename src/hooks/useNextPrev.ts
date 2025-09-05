"use client";
import { useRef, useCallback } from "react";
import { useFilters } from "@/state/filters";

type Detail = { gender:string; countries:string[] };

function emit(type:"ui:next"|"ui:prev", detail:Detail){
  try{
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(type, { detail }));
    }
  }catch{}
}

export function useNextPrev(){
  const { gender, countries } = useFilters();
  const lastTs = useRef(0);

  const guard = () => {
    const now = Date.now();
    if (now - lastTs.current < 700) return false; // حارس ازدواج
    lastTs.current = now; return true;
  };

  const next = useCallback(()=>{ if(!guard()) return;
    const detail = { gender, countries };
    emit("ui:next", detail);
  }, [gender, countries]);

  const prev = useCallback(()=>{ if(!guard()) return;
    const detail = { gender, countries };
    emit("ui:prev", detail);
  }, [gender, countries]);

  return { next, prev };
}