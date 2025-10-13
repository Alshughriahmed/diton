"use client";

/* ======================= boot / guards ======================= */
import safeFetch from "@/app/chat/safeFetch";
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

if (process.env.NODE_ENV !== "production") {
  if (typeof window !== "undefined") {
    // لا تزعج المستخدم بأخطاء إلغاء الطلبات
    window.addEventListener("unhandledrejection", (e) => {
      const r = (e as any).reason;
      const msg = String((r && r.message) || "");
      if ((r && r.name === "AbortError") || /aborted/i.test(msg)) e.preventDefault();
    });
  }
}

/* ======================= react & app hooks ======================= */
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import * as rtc from "./rtcFlow";

import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import { useHydrated } from "@/hooks/useHydrated";

import {
  initLocalMedia,
  getLocalStream,
  toggleMic,
  toggleCam,
  switchCamera,
} from "@/lib/media";

import { useFilters } from "@/state/filters";
import { useFFA } from "@/lib/useFFA";
import { useRouter } from "next/navigation";
import { getMobileOptimizer } from "@/lib/mobile";
import { toast } from "@/lib/ui/toast";
import { tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

/* ======================= UI components ======================= */
import ChatComposer from "@/components/chat/ChatComposer";
import LikeSystem from "@/components/chat/LikeSystem";
import PeerInfoCard from "@/components/chat/PeerInfoCard";
import PeerMetadata from "@/components/chat/PeerMetadata";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import LikeHud from "./LikeHud";

/* ======================= types / consts ======================= */
type MatchEcho = { ts: number; gender: string; countries: string[] };
const NEXT_COOLDOWN_MS = 700;
const isBrowser = typeof window !== "undefined";

/* ============================================================= */

export default function ChatClient() {
  const ffa = useFFA();
  const router = useRouter();
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();

  // ===== local refs / state
  const localRef = useRef<HTMLVideoElement>(null);
  const lastNextTsRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [like, setLike] = useState(false);
  const [peerLikes, setPeerLikes] = useState(0);

  const [rtcPhase, setRtcPhase] = useState<"idle" | "searching" | "matched" | "connected" | "stopped">("idle");
  const [pair, setPair] = useState<{ id?: string; role?: "caller" | "callee" }>({});

  const { isVip: vip } = useFilters();
  const { profile } = useProfile();

  const [beauty, setBeauty] = useState(false);
  const [effectsStream, setEffectsStream] = useState<MediaStream | null>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>("");

  const [peerInfo, setPeerInfo] = useState({
    name: "Anonymous",
    isVip: false,
    likes: 0,
    isOnline: true,
    country: "",
    city: "",
    gender: "",
    age: 0,
  });

  /* ---------- helpers ---------- */
  function updatePeerBadges(meta: any) {
    try {
      if (!meta || !isBrowser) return;
      const g = document.querySelector('[data-ui="peer-gender"]');
      const ctry = document.querySelector('[data-ui="peer-country"]');
      const cty = document.querySelector('[data-ui="peer-city"]');
      if (g) (g as HTMLElement).textContent = meta.gender ? String(meta.gender) : "—";
      if (ctry) (ctry as HTMLElement).textContent = meta.country ? String(meta.country) : "—";
      if (cty) (cty as HTMLElement).textContent = meta.city ? String(meta.city) : "";
    } catch {}
  }

  /* ---------- peer-meta-ui (فوري للبادجات) ---------- */
  useEffect(() => {
    if (!isBrowser) return;
    const handler = (event: any) => {
      try {
        const meta = event.detail;
        if (meta) {
          setPeerInfo((p) => ({
            ...p,
            country: meta.country ?? p.country,
            city: meta.city ?? p.city,
            gender: meta.gender ?? p.gender,
          }));
          updatePeerBadges(meta);
          console.log("UI_META", meta);
        }
      } catch {}
    };
    window.addEventListener("ditona:peer-meta-ui", handler as any);
    return () => window.removeEventListener("ditona:peer-meta-ui", handler as any);
  }, []);

  /* ---------- أوتو ستارت بعد الهاييدريشن ---------- */
  useEffect(() => {
    if (!hydrated || !isBrowser) return;
    if ((window as any).__ditonaAutostartDone) return;
    (window as any).__ditonaAutostartDone = 1;

    const doAutoStart = async () => {
      try {
        const { prefetchGeo } = await import("@/lib/geoCache");
        prefetchGeo();
        console.log("[auto-start] Geo prefetch initiated");

        await new Promise((r) => setTimeout(r, 500));

        const stream = await initLocalMedia();
        if (stream && localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current.play().catch(() => {});
        }

        await new Promise((r) => setTimeout(r, 200));
        window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "boot" } }));

        try {
          const opts = {
            method: "POST",
            credentials: "include" as RequestCredentials,
            cache: "no-store" as RequestCache,
          };
          await safeFetch("/api/age/allow", opts);
          await safeFetch("/api/anon/init", opts);
        } catch (e) {
          console.warn("age/allow or anon/init failed", e);
        }

        emit("ui:next");
        console.log("AUTO_NEXT: fired");
        console.log("[auto-start] Successfully started RTC flow");
      } catch (err) {
        console.warn("[auto-start] Failed:", err);
      }
    };

    const t = setTimeout(doAutoStart, 100);
    return () => clearTimeout(t);
  }, [hydrated]);

  /* ---------- أحداث الواجهة / اختصارات ---------- */
  useKeyboardShortcuts();
  useGestures();

  useEffect(() => {
    // media & controls
    const off1 = on("ui:toggleMic", () => toggleMic());
    const off2 = on("ui:toggleCam", () => toggleCam());
    const off3 = on("ui:switchCamera", async () => {
      try {
        const newStream = await switchCamera();
        if (localRef.current && newStream) {
          localRef.current.srcObject = newStream;
          localRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn("Camera switch failed:", e);
      }
    });

    const off4 = on("ui:openSettings", () => {
      try {
        window.location.href = "/settings";
      } catch {}
    });

    const off5 = on("ui:like", async (data) => {
      try {
        const currentPairId = (data && (data as any).pairId) || pair.id;
        const dc = (globalThis as any).__ditonaDataChannel;

        if (!currentPairId || !dc || dc.readyState !== "open") {
          toast("لا يوجد اتصال نشط للإعجاب");
          return;
        }

        const newLike = !like;
        setLike(newLike);

        dc.send(JSON.stringify({ t: "like", pairId: currentPairId, liked: newLike }));
        safeFetch(`/api/like?pairId=${encodeURIComponent(currentPairId)}&op=toggle`, {
          method: "POST",
        }).catch(() => {});

        toast(`تم الإعجاب ${newLike ? "❤️" : "💔"}`);
      } catch (e) {
        console.warn("Like failed:", e);
      }
    });

    const off6 = on("ui:report", async () => {
      try {
        await safeFetch("/api/moderation/report", { method: "POST" });
        toast("🚩 تم إرسال البلاغ وجاري الانتقال");
      } catch {}
      rtc.next();
    });

    const off7 = on("ui:next", () => {
      const now = Date.now();
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now;
      rtc.next();
    });

    const off8 = on("ui:prev", () => {
      tryPrevOrRandom();
    });

    const offOpenMsg = on("ui:openMessaging" as any, () => setShowMessaging(true));
    const offCloseMsg = on("ui:closeMessaging" as any, () => setShowMessaging(false));

    const offRemoteAudio = on("ui:toggleRemoteAudio" as any, () => {
      const a = document.getElementById("remoteAudio") as HTMLAudioElement | null;
      if (a) {
        a.muted = !a.muted;
        toast(a.muted ? "🔇 صمت الطرف الثاني" : "🔈 سماع الطرف الثاني");
        return;
      }
      const v = document.querySelector('video[data-role="remote"],#remoteVideo') as HTMLVideoElement | null;
      if (v) {
        v.muted = !v.muted;
        toast(v.muted ? "🔇 صمت الطرف الثاني" : "🔈 سماع الطرف الثاني");
      }
    });

    const offTogglePlay = on("ui:togglePlay", () => {
      toast("تبديل حالة المطابقة");
    });

    const offToggleMasks = on("ui:toggleMasks", () => {
      toast("🤡 تفعيل/إلغاء الأقنعة");
    });

    const offMirror = on("ui:toggleMirror", () => {
      setIsMirrored((prev) => {
        const s = !prev;
        toast(s ? "🪞 تفعيل المرآة" : "📹 إلغاء المرآة");
        return s;
      });
    });

    const offUpsell = on("ui:upsell", (d: any) => {
      if (ffa) return;
      router.push(`/plans?ref=${d?.ref || d?.feature || "generic"}`);
    });

    // تحديث الفلاتر ⇒ إعادة enqueue ثم next
    const reEnqueue = async () => {
      try {
        const { useFilters } = await import("@/state/filters");
        const { gender, countries } = useFilters.getState();
        await safeFetch("/api/rtc/enqueue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            gender: "unknown",
            country: "UNKNOWN",
            filterGenders: gender === "all" ? "all" : gender,
            filterCountries: countries?.length ? countries.join(",") : "ALL",
          }),
        });
      } catch {}
      rtc.next();
    };
    const offCountry = on("filters:country", reEnqueue);
    const offGender = on("filters:gender", reEnqueue);

    // حالـة RTC / الـ pair / الستريم البعيد
    const offRtcPhase = on("rtc:phase" as any, (data) => {
      setRtcPhase(data.phase);
    });

    const offRtcPair = on("rtc:pair" as any, (data) => {
      setPair({ id: data.pairId, role: data.role });
      setPeerInfo((p) => ({
        ...p,
        name: "Partner",
        likes: Math.floor(Math.random() * 500),
      }));
    });

    const offRtcTrack = on("rtc:remote-track" as any, (data) => {
      const remoteVideo = document.querySelector("#remoteVideo") as HTMLVideoElement | null;
      if (remoteVideo && data.stream) {
        remoteVideo.srcObject = data.stream;
        try {
          const remoteAudio = document.getElementById("remoteAudio") as HTMLAudioElement | null;
          if (remoteAudio) {
            remoteAudio.srcObject = remoteVideo.srcObject as any;
            remoteAudio.muted = false;
            remoteAudio.play?.().catch(() => {});
          }
        } catch {}
        try {
          remoteVideo.play?.().catch(() => {});
        } catch {}
      }
    });

    // مؤثرات الجمال / الأقنعة
    const offBeauty = on("ui:toggleBeauty", async (data) => {
      try {
        if (!isBrowser) return;
        const { getVideoEffects } = await import("@/lib/effects");
        const fx = getVideoEffects();
        if (fx) {
          fx.updateConfig({ beauty: { enabled: data.enabled, ...(data.settings || {}) } });
          setBeauty(!!data.enabled);
        }
      } catch (e) {
        console.warn("Beauty toggle failed:", e);
      }
    });

    const offBeautyUpdate = on("ui:updateBeauty", async (data) => {
      try {
        if (!isBrowser) return;
        const { getVideoEffects } = await import("@/lib/effects");
        const fx = getVideoEffects();
        if (fx) fx.updateConfig({ beauty: { enabled: beauty, ...(data.settings || {}) } });
      } catch (e) {
        console.warn("Beauty update failed:", e);
      }
    });

    const offMask = on("ui:changeMask", async (data) => {
      try {
        if (!isBrowser) return;
        const { getVideoEffects } = await import("@/lib/effects");
        const fx = getVideoEffects();
        if (fx) fx.updateConfig({ mask: { enabled: data.type !== "none", type: data.type } });
      } catch (e) {
        console.warn("Mask change failed:", e);
      }
    });

    // ميتا من النظير
    const handlePeerMeta = (e: any) => {
      const meta = e.detail;
      if (meta) {
        setPeerInfo((prev) => ({
          ...prev,
          country: meta.country || prev.country,
          gender: meta.gender || prev.gender,
        }));
        updatePeerBadges(meta);
      }
    };
    if (isBrowser) {
      window.addEventListener("ditona:peer-meta", handlePeerMeta as any);
      window.addEventListener("rtc:peer-like", (e: any) => {
        const detail = e.detail;
        if (detail && typeof detail.liked === "boolean") {
          setPeerLikes(detail.liked ? 1 : 0);
          toast(`${detail.liked ? "أعجب" : "ألغى الإعجاب"} بك الشريك ${detail.liked ? "❤️" : "💔"}`);
        }
      });
    }

    // تهيئة الميديا بإشعارات أذونات أو تبويب غير نشط
    const initMediaWithPermissionChecks = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          setCameraPermissionHint("قم بالعودة إلى التبويب لتفعيل الكاميرا");
          return;
        }
        setCameraPermissionHint("");
        await initLocalMedia();
        setCameraPermissionHint("");
      } catch (error: any) {
        console.warn("Media initialization failed:", error);
        if (error?.name === "NotAllowedError") {
          setCameraPermissionHint("قم بالسماح للكاميرا والميكروفون من إعدادات المتصفح");
        } else if (error?.name === "NotReadableError" || error?.name === "AbortError") {
          setCameraPermissionHint("قم بإغلاق التبويب الثاني أو اسمح للكاميرا");
        } else if (error?.name === "NotFoundError") {
          setCameraPermissionHint("لم يتم العثور على كاميرا أو ميكروفون");
        } else {
          setCameraPermissionHint("خطأ في الوصول للكاميرا - تأكد من الأذونات");
        }
        return;
      }

      const s = getLocalStream();
      if (localRef.current && s) {
        if (vip && isBrowser) {
          try {
            const { getVideoEffects } = await import("@/lib/effects");
            const fx = getVideoEffects();
            if (fx) {
              const v = document.createElement("video");
              v.srcObject = s;
              void v.play();
              const processed = await fx.initialize(v);
              if (processed) {
                setEffectsStream(processed);
                localRef.current.srcObject = processed;
                fx.start();
              } else {
                localRef.current.srcObject = s;
              }
            } else {
              localRef.current.srcObject = s;
            }
          } catch (e) {
            console.warn("Effects init failed, fallback to raw stream:", e);
            localRef.current.srcObject = s;
          }
        } else {
          localRef.current.srcObject = s;
        }

        localRef.current.muted = true;
        localRef.current.play().catch(() => {});

        // بعد الميديا ابدأ RTC
        if (localRef.current?.srcObject) {
          const m = await rtc
            .start(localRef.current.srcObject as MediaStream, setRtcPhase)
            .catch(() => undefined as any);
          if (m?.pairId && m?.role) {
            window.dispatchEvent(new CustomEvent("rtc:matched", { detail: m }));
          }
        }
        setReady(true);
      }
    };

    initMediaWithPermissionChecks().catch(() => {});

    // Mobile viewport optimizer
    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe((vp) => {
      console.log("Viewport changed:", vp);
    });

    // تنظيف
    return () => {
      off1();
      off2();
      off3();
      off4();
      off5();
      off6();
      off7();
      off8();
      offOpenMsg();
      offCloseMsg();
      offRemoteAudio();
      offTogglePlay();
      offToggleMasks();
      offMirror();
      offUpsell();
      offCountry();
      offGender();
      offRtcPhase();
      offRtcPair();
      offRtcTrack();
      offBeauty();
      offBeautyUpdate();
      offMask();
      if (isBrowser) window.removeEventListener("ditona:peer-meta", handlePeerMeta as any);
      unsubMob();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.id, vip, ffa, router]);

  // أوقف RTC عند إزالة المكوّن
  useEffect(() => () => { try { rtc.stop(); } catch {} }, []);

  // سحب بالإيماءة (التالي/السابق)
  useEffect(() => {
    if (!isBrowser) return;
    let x0 = 0,
      y0 = 0;
    const down = (e: PointerEvent) => {
      x0 = e.clientX;
      y0 = e.clientY;
    };
    const up = (e: PointerEvent) => {
      const dx = e.clientX - x0,
        dy = e.clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          toast("⏭️ سحب للمطابقة التالية");
          emit("ui:next");
        } else {
          if (ffa) console.log("FFA_FORCE: enabled");
          if (!vip && !ffa) {
            toast("🔒 العودة للسابق متاحة لـ VIP فقط");
            emit("ui:upsell", "prev");
          } else {
            toast("⏮️ محاولة العودة للمطابقة السابقة...");
            emit("ui:prev");
          }
        }
      }
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [vip, ffa]);

  /* ======================= UI ======================= */

  if (!hydrated) {
    return (
      <div className="min-h-screen h-screen w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
        <FilterBar />
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-slate-300/80 text-sm">Loading...</div>
          </section>
          <section className="relative rounded-2xl bg-black/20 overflow-hidden pb-28 md:pb-24">
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Initializing...</div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <LikeHud />
      <div className="min-h-screen h-screen w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" data-chat-container>
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          {/* ======= الأعلى (الطرف الآخر) ======= */}
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <PeerInfoCard peerInfo={peerInfo} />
            <PeerMetadata country={peerInfo.country} city={peerInfo.city} gender={peerInfo.gender} age={peerInfo.age} />
            <FilterBar />
            <MessageHud />

            {/* زر الإعجاب */}
            <div className="absolute bottom-4 right-4 z-30">
              <LikeSystem />
            </div>

            {/* فيديو الطرف الآخر + أوديو مخفي (لـ iOS) */}
            <video id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio id="remoteAudio" autoPlay playsInline hidden />

            {/* طبقة البحث */}
            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button
                  onClick={() => {
                    try {
                      rtc.stop();
                      toast("🛑 تم إلغاء البحث");
                    } catch (e) {
                      console.warn("Cancel failed:", e);
                    }
                  }}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* ======= الأسفل (أنا) ======= */}
          <section className="relative rounded-2xl bg-black/20 overflow-hidden">
            <video
              ref={localRef}
              data-local-video
              className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`}
              playsInline
              muted
              autoPlay
            />

            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm text-center px-4">
                {cameraPermissionHint ? (
                  <>
                    <div className="mb-2 text-yellow-400">⚠️</div>
                    <div className="mb-4">{cameraPermissionHint}</div>
                    <button
                      onClick={() => {
                        setCameraPermissionHint("");
                        initLocalMedia()
                          .then(async () => {
                            const s = getLocalStream();
                            if (localRef.current && s) {
                              if (vip && isBrowser) {
                                try {
                                  const { getVideoEffects } = await import("@/lib/effects");
                                  const fx = getVideoEffects();
                                  if (fx) {
                                    const v = document.createElement("video");
                                    v.srcObject = s;
                                    void v.play();
                                    const processed = await fx.initialize(v);
                                    if (processed) {
                                      setEffectsStream(processed);
                                      localRef.current.srcObject = processed;
                                      fx.start();
                                    } else {
                                      localRef.current.srcObject = s;
                                    }
                                  } else {
                                    localRef.current.srcObject = s;
                                  }
                                } catch {
                                  localRef.current.srcObject = s;
                                }
                              } else {
                                localRef.current.srcObject = s;
                              }
                              localRef.current.muted = true;
                              localRef.current.play().catch(() => {});

                              if (localRef.current?.srcObject) {
                                const m = await rtc
                                  .start(localRef.current.srcObject as MediaStream, setRtcPhase)
                                  .catch(() => undefined as any);
                                if (m?.pairId && m?.role) {
                                  window.dispatchEvent(new CustomEvent("rtc:matched", { detail: m }));
                                }
                              }
                              setReady(true);
                            }
                          })
                          .catch((error) => {
                            console.warn("Retry failed:", error);
                            if ((error as any)?.name === "NotAllowedError") {
                              setCameraPermissionHint("قم بالسماح للكاميرا والميكروفون من إعدادات المتصفح");
                            } else if ((error as any)?.name === "NotReadableError" || (error as any)?.name === "AbortError") {
                              setCameraPermissionHint("قم بإغلاق التبويب الثاني أو اسمح للكاميرا");
                            } else {
                              setCameraPermissionHint("خطأ في الوصول للكاميرا - تأكد من الأذونات");
                            }
                          });
                      }}
                      className="px-4 py-2 bg-blue-500/80 hover:bg-blue-600/80 rounded-lg text-white font-medium transition-colors duration-200"
                    >
                      إعادة المحاولة
                    </button>
                  </>
                ) : (
                  <div>Requesting camera/mic…</div>
                )}
              </div>
            )}

            <MyControls />
            <div id="gesture-layer" className="absolute inset-0 -z-10" />
          </section>

          {/* أدوات الشريط السفلي + الرسائل + العروض */}
          <ChatToolbar />
          <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
          <ChatMessagingBar />
        </div>
      </div>
    </>
  );
}
