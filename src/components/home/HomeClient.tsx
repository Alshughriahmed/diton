// src/components/home/HomeClient.tsx
"use client";

import "@/app/i18nReset.client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderLite from "@/components/HeaderLite";
import safeFetch from "@/app/chat/safeFetch";
import { useProfile } from "@/state/profile";
import { normalizeGender } from "@/lib/gender";

type MyGender = "male" | "female" | "couple" | "lgbt";

const genderOptions = [
  { key: "male",   label: "Male",   symbol: "♂" },
  { key: "female", label: "Female", symbol: "♀" },
  { key: "couple", label: "Couple", symbol: "⚥" },
  { key: "lgbt",   label: "LGBT",   symbol: "🏳️‍🌈 ⚧" },
] as const;

function classesFor(g: MyGender) {
  switch (g) {
    case "male":   return { text: "text-blue-600",  border: "border-blue-600",  rainbow: false };
    case "female": return { text: "text-red-600",   border: "border-red-600",   rainbow: false };
    case "couple": return { text: "text-rose-400",  border: "border-rose-400",  rainbow: false };
    case "lgbt":   return { text: "",               border: "border-purple-600", rainbow: true };
  }
}

const rainbowText =
  "bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-500 via-blue-500 to-purple-600 bg-clip-text text-transparent";

function normToHome(n: string | undefined): MyGender | null {
  switch (normalizeGender(n)) {
    case "m": return "male";
    case "f": return "female";
    case "c": return "couple";
    case "l": return "lgbt";
    default:  return null;
  }
}

export default function HomeClient() {
  const router = useRouter();
  const profileStore = useProfile();

  const [gender, setGender] = useState<MyGender | null>(null);
  const [ageOk, setAgeOk] = useState(false);

  // read persisted choice or profile on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ditona_myGender");
      if (saved) {
        setGender(saved as MyGender);
        profileStore.setGender(saved);
        return;
      }
    } catch {}
    setGender(normToHome((profileStore as any)?.profile?.gender) as MyGender | null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectGender(next: MyGender) {
    setGender(next);
    // Update *profile only*. Do not touch filters here.
    try { profileStore.setGender(next); } catch {}
    try { localStorage.setItem("ditona_myGender", String(next)); } catch {}
  }

  // lightweight geo cache (optional; used elsewhere)
  useEffect(() => {
    const done = (d: any) => {
      try { localStorage.setItem("ditona_geo", JSON.stringify(d)); } catch {}
    };
    try {
      const g = (navigator as any)?.geolocation;
      if (g) {
        let timedOut = false;
        const t = setTimeout(() => { timedOut = true; }, 3000);
        g.getCurrentPosition(
          (pos: any) => { if (!timedOut) { clearTimeout(t); done({ lat: pos.coords.latitude, lon: pos.coords.longitude, src: "geolocation" }); } },
          () => {},
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 2500 }
        );
      }
    } catch {}
    safeFetch("/api/geo").then(r => r.json()).then(done).catch(() => {});
  }, []);

  const canStart = useMemo(() => Boolean(gender) && ageOk, [gender, ageOk]);

  async function onStart() {
    if (!canStart) return;
    try { await safeFetch("/api/age/allow", { method: "POST" }).catch(() => {}); }
    finally { router.push("/chat"); }
  }

  return (
    <div className="relative min-h-screen text-white">
      {/* الخلفية */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('/hero.webp')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-black/60" />
      </div>

      <HeaderLite />

      {/* محتوى مركزي: العنوان + صندوق الجنس في منتصف الشاشة */}
      <main className="px-4">
        <div className="mx-auto max-w-4xl min-h-[calc(100dvh-80px)] flex flex-col items-center justify-center text-center">
          {/* العنوان الجديد */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600">
              Ditona Video Chat{" "}
            </span>
            <span className="align-super text-red-500">+18</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg md:text-xl text-gray-200">
            💥Unleash your madness💥
          </p>

          {/* صندوق خيارات الجنس وسط الصفحة */}
          <div className="mt-8 w-full max-w-lg bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl">
            <label className="block text-sm text-gray-300 mb-2">Select your gender</label>
            <div className="grid grid-cols-2 gap-3">
              {genderOptions.map(opt => {
                const cls = classesFor(opt.key as MyGender);
                const active = gender === opt.key ? "ring-2 ring-white" : "";
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => selectGender(opt.key as MyGender)}
                    className={`px-3 py-3 rounded-lg border bg-black/40 hover:bg-black/30 transition-colors ${active} ${cls.border}`}
                    aria-label={opt.label}
                  >
                    {opt.key !== "lgbt" ? (
                      <span className={`flex items-center justify-center gap-2 ${cls.text}`}>
                        <span className="text-2xl leading-none">{opt.symbol}</span>
                        <span className="text-base font-semibold">{opt.label}</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-2xl leading-none">🏳️‍🌈</span>
                        <span className={`text-2xl leading-none ${rainbowText}`}>⚧</span>
                        <span className={`text-base font-semibold ${rainbowText}`}>LGBT</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 justify-center">
              <input id="ageok" type="checkbox" className="h-4 w-4" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
              <label htmlFor="ageok" className="text-sm text-gray-200">I confirm I am 18+</label>
            </div>

            <button
              onClick={onStart}
              disabled={!canStart}
              className="mt-6 w-full py-3 rounded-xl text-white text-lg font-semibold bg-gradient-to-r from-fuchsia-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
            >
              Start Video Chat
            </button>

            <div className="mt-4 text-center text-sm text-gray-300 space-x-4">
              <a href="/terms" className="hover:text-white">Terms of Use</a>
              <a href="/privacy" className="hover:text-white">Privacy Policy</a>
            </div>
            <div className="mt-2 text-center text-xs text-gray-400 space-x-3">
              <a href="mailto:info@ditonachat.com" className="hover:text-gray-200">info@ditonachat.com</a>
              <a href="mailto:user@ditonachat.com" className="hover:text-gray-200">user@ditonachat.com</a>
              <a href="mailto:suggestions@ditonachat.com" className="hover:text-gray-200">suggestions@ditonachat.com</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
