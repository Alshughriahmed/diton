"use client";
import { safeFetch } from "./safeFetch";
// side-effect module, runs in client because it's imported by a client component
// Minimal-Diff wiring for message sending with per-pair limit handled server-side.

import { busOn as on, busEmit as emit } from "@/utils/bus";

let currentPairId: string = "";
let wiredForms = new WeakSet<HTMLFormElement>();

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&") + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function getAnon(): string {
  // try multiple cookie names
  const c1 = readCookie("anon");
  const c2 = readCookie("ditona_anon");
  return c1 || c2 || "";
}

async function send(text: string, pairId: string): Promise<"ok"|"limit"|"err"> {
  try {
    // Check message allowance for non-VIP first
    const ok = await fetch('/api/message/allow', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ pairId })
    }).then(r => r.ok).catch(()=>false);
    if(!ok) return "limit"; // Will trigger upsell

    const r = await safeFetch("/api/message", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-anon": getAnon(),
      },
      body: JSON.stringify({ text, pairId }),
    });
    if (r.status === 429) return "limit";
    if (!r.ok) return "err";
    return "ok";
  } catch {
    return "err";
  }
}

function bindForm(form: HTMLFormElement) {
  if (!form || wiredForms.has(form)) return;
  const input = form.querySelector<HTMLInputElement>('[data-ui="msg-input"], input[name="message"], textarea[name="message"]');
  const btn   = form.querySelector<HTMLButtonElement>('[data-ui="msg-send"], button[type="submit"]');
  if (!input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (input.value || "").trim();
    if (!text) return;
    try {
      btn?.setAttribute("disabled", "");
      const res = await send(text, currentPairId);
      if (res === "ok") {
        input.value = "";
        emit("ui:msg:sent", { text, pairId: currentPairId });
      } else if (res === "limit") {
        emit("ui:upsell", "messages");
      } else {
        emit("ui:toast", { type: "error", text: "Message failed" });
      }
    } finally {
      btn?.removeAttribute("disabled");
    }
  });

  wiredForms.add(form);
}

function scanAndBind() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLFormElement>('[data-ui="msg-form"], form[data-msg], form#chat-msg-form')
    .forEach(bindForm);
}

function setupObserver() {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
  const obs = new MutationObserver(() => scanAndBind());
  obs.observe(document.body, { subtree: true, childList: true });
  scanAndBind();
}

// reset count perspective per pair and keep latest pairId
on("rtc:pair", (p: any) => {
  currentPairId = (p?.pairId || p?.id || "") + "";
  // optional UI hook
  emit("ui:msg:pair", { pairId: currentPairId });
});

// initial kick
if (typeof window !== "undefined") {
  if (!(window as any).__ditona_msg_wired) {
    (window as any).__ditona_msg_wired = true;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { setupObserver(); });
    } else {
      setupObserver();
    }
  }
}

export {};
