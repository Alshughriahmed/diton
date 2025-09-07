"use client";
import { useRef, useCallback } from "react";
import { emit } from "@/utils/events";

export function useNextPrev() {
  const lastTimestamp = useRef(0);
  const isNetworkPending = useRef(false);
  const COOLDOWN_MS = 700;

  const canProceed = useCallback(() => {
    const now = Date.now();
    if (now - lastTimestamp.current < COOLDOWN_MS) {
      return false; // Still in cooldown
    }
    if (isNetworkPending.current) {
      return false; // Network request in progress
    }
    lastTimestamp.current = now;
    return true;
  }, []);

  const next = useCallback(async () => {
    if (!canProceed()) return;

    isNetworkPending.current = true;
    try {
      // Emit UI event immediately
      emit("ui:next");
      
      // DEDUPE: delegated to ChatClient.doMatch via bus
    } catch (error) {
      console.debug('[NEXT_ERROR]', error);
    } finally {
      isNetworkPending.current = false;
    }
  }, [canProceed]);

  const prev = useCallback(async () => {
    if (!canProceed()) return;

    isNetworkPending.current = true;
    try {
      emit("ui:prev");
      
      // DEDUPE: delegated to ChatClient.doMatch via bus
    } catch (error) {
      console.debug('[PREV_ERROR]', error);
    } finally {
      isNetworkPending.current = false;
    }
  }, [canProceed]);

  return { next, prev };
}
