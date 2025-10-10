"use client";

// نحافظ على توقيع الاستيراد الحالي إن كان مستخدمًا في مواضع أخرى:
import { getAnonId } from "./anonState";

/**
 * apiSafeFetch: توحيد إعدادات fetch لنداءات /api/rtc/*
 * - cache: "no-store"
 * - credentials: "include"
 * - keepalive: true
 * - timeoutMs افتراضي 12s
 * - حقن x-req-id دائمًا
 * - حقن x-anon-id إن كان متوفرًا من anonState
 */
export default async function apiSafeFetch(
  input: RequestInfo | URL,
  init: (RequestInit & { timeoutMs?: number }) = {}
): Promise<Response> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), init.timeoutMs ?? 12000);

  const headers = new Headers(init.headers || {});
  if (!headers.has("x-req-id")) headers.set("x-req-id", genId());

  const aid = safeAnon();
  if (aid && !headers.has("x-anon-id")) headers.set("x-anon-id", aid);

  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      credentials: "include",
      keepalive: true,
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(to);
  }
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4);
}

function safeAnon(): string | null {
  try {
    const a = getAnonId?.();
    if (a) return String(a);
  } catch {}
  // fallback من الكوكي عند الضرورة (تحاشيًا لأي قطع في anonState)
  try {
    const m = document.cookie.match(/(?:^|;\s*)anon=([^;]+)/);
    if (m) {
      const raw = decodeURIComponent(m[1]);
      const parts = raw.split(".");
      return parts.length === 3 ? parts[1] : raw;
    }
  } catch {}
  return null;
}
